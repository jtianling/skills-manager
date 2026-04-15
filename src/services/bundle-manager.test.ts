import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { SourcesService } from './sources.js';
import { BundleManager } from './bundle-manager.js';
import { GroupsService } from './groups.js';

function writeSkill(path: string, name: string, content = name): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'SKILL.md'), `---\nname: ${name}\n---\n${content}`);
}

describe('BundleManager', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-bundle-manager-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('syncs local batch bundle and installs newly added skills', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-source-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha', 'alpha');
    writeSkill(join(sourceDir, 'beta'), 'beta', 'beta');

    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha', 'alpha');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(`local-batch:${sourceDir}`, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/spec-tdd/alpha'],
    });

    const manager = new BundleManager(sourcesService);
    const result = await manager.sync(`local-batch:${sourceDir}`);

    expect(result).toMatchObject({
      updated: 0,
      upToDate: 1,
      added: 1,
      addedSkipped: 0,
      removedKept: 0,
      removedHard: 0,
      failed: 0,
    });
    expect(readFileSync(join(testManagerDir, 'custom', 'spec-tdd', 'beta', 'SKILL.md'), 'utf-8'))
      .toContain('beta');
    expect(sourcesService.getSource('custom/spec-tdd/beta')).toMatchObject({
      repoName: 'beta',
      installMethod: 'local-copy',
    });
    expect(sourcesService.getBundle(`local-batch:${sourceDir}`)?.members.sort()).toEqual([
      'custom/spec-tdd/alpha',
      'custom/spec-tdd/beta',
    ]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('hard removes missing local batch members when sync flag is enabled', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-remove-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha', 'alpha');

    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha', 'alpha');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'beta'), 'beta', 'beta');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/spec-tdd/beta', {
      url: sourceDir,
      type: 'custom',
      repoName: 'beta',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(`local-batch:${sourceDir}`, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/spec-tdd/alpha', 'custom/spec-tdd/beta'],
    });
    groupsService.addSkill('test', 'custom/spec-tdd/beta');

    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(`local-batch:${sourceDir}`, { sync: true });

    expect(result.removedHard).toBe(1);
    expect(sourcesService.getSource('custom/spec-tdd/beta')).toBeUndefined();
    expect(sourcesService.getBundle(`local-batch:${sourceDir}`)?.members).toEqual([
      'custom/spec-tdd/alpha',
    ]);
    expect(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8')).not.toContain('beta');

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('returns empty result for zip bundles', async () => {
    const sourcesService = new SourcesService();
    sourcesService.addBundle('zip:https://example.com/skills.zip', {
      type: 'zip',
      url: 'https://example.com/skills.zip',
      selectionMode: 'all',
      members: ['custom/pkg/alpha'],
    });

    const manager = new BundleManager(sourcesService);
    const result = await manager.sync('zip:https://example.com/skills.zip');

    expect(result).toEqual({
      updated: 0,
      upToDate: 0,
      added: 0,
      addedSkipped: 0,
      removedKept: 0,
      removedHard: 0,
      failed: 0,
    });
    expect(console.log).toHaveBeenCalledWith('  zip bundle update not supported, reinstall required');
  });

  it('syncs git bundle using fallback path discovery', async () => {
    writeSkill(join(testManagerDir, 'official', 'anthropic', 'skills', 'commit'), 'commit', 'same');

    const sourcesService = new SourcesService();
    sourcesService.addSource('official/anthropic/skills', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'skills',
      installMethod: 'git',
    });
    sourcesService.addBundle('git:https://github.com/anthropics/skills', {
      type: 'git',
      url: 'https://github.com/anthropics/skills',
      selectionMode: 'all',
      members: ['official/anthropic/skills'],
    });

    const githubService: {
      parseGitHubUrl: () => { owner: string; repo: string };
      listSkillsWithFallbackPaths: ReturnType<typeof vi.fn>;
      getDefaultBranch: ReturnType<typeof vi.fn>;
      fetchRootFile: ReturnType<typeof vi.fn>;
      downloadRepoRoot: ReturnType<typeof vi.fn>;
      downloadSkill: ReturnType<typeof vi.fn>;
    } = {
      parseGitHubUrl: () => ({ owner: 'anthropics', repo: 'skills' }),
      listSkillsWithFallbackPaths: vi.fn().mockResolvedValue({
        skillsPath: 'skills',
        skills: [{ name: 'commit', path: 'skills/commit' }],
      }),
      getDefaultBranch: vi.fn().mockResolvedValue('main'),
      fetchRootFile: vi.fn().mockResolvedValue(null),
      downloadRepoRoot: vi.fn(),
      downloadSkill: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => '---\nname: commit\n---\nsame',
    })));

    const manager = new BundleManager(sourcesService, githubService as never);
    const result = await manager.sync('git:https://github.com/anthropics/skills');

    expect(result.upToDate).toBe(1);
    expect(githubService.listSkillsWithFallbackPaths).toHaveBeenCalledWith(
      'anthropics',
      'skills',
    );
  });

  it('syncs added skill in all mode by auto-installing', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-all-${Date.now()}`, 'batch');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'existing'), 'existing', 'existing');
    writeSkill(join(sourceDir, 'new-skill'), 'new-skill', 'new-skill');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'existing'), 'existing', 'existing');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/batch/existing', {
      url: sourceDir,
      type: 'custom',
      repoName: 'existing',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/batch/existing'],
    });

    const addSourceSpy = vi.spyOn(sourcesService, 'addSource');
    const updateBundleMembersSpy = vi.spyOn(sourcesService, 'updateBundleMembers');
    const manager = new BundleManager(sourcesService);

    const result = await manager.sync(bundleId, {});

    expect(result.added).toBe(1);
    expect(readFileSync(join(testManagerDir, 'custom', 'batch', 'new-skill', 'SKILL.md'), 'utf-8'))
      .toContain('new-skill');
    expect(sourcesService.getBundle(bundleId)?.members).toEqual([
      'custom/batch/existing',
      'custom/batch/new-skill',
    ]);
    expect(addSourceSpy).toHaveBeenCalledWith('custom/batch/new-skill', {
      url: sourceDir,
      type: 'custom',
      repoName: 'new-skill',
      installMethod: 'local-copy',
    });
    expect(updateBundleMembersSpy).toHaveBeenCalledWith(bundleId, [
      'custom/batch/existing',
      'custom/batch/new-skill',
    ]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('skips added skill in subset mode', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-subset-${Date.now()}`, 'batch');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'existing'), 'existing', 'existing');
    writeSkill(join(sourceDir, 'new-skill'), 'new-skill', 'new-skill');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'existing'), 'existing', 'existing');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/batch/existing', {
      url: sourceDir,
      type: 'custom',
      repoName: 'existing',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'subset',
      members: ['custom/batch/existing'],
    });

    const addSourceSpy = vi.spyOn(sourcesService, 'addSource');
    const updateBundleMembersSpy = vi.spyOn(sourcesService, 'updateBundleMembers');
    const manager = new BundleManager(sourcesService);

    const result = await manager.sync(bundleId, {});

    expect(result.addedSkipped).toBe(1);
    expect(result.added).toBe(0);
    expect(existsSync(join(testManagerDir, 'custom', 'batch', 'new-skill'))).toBe(false);
    expect(sourcesService.getSource('custom/batch/new-skill')).toBeUndefined();
    expect(sourcesService.getBundle(bundleId)?.members).toEqual(['custom/batch/existing']);
    expect(addSourceSpy).not.toHaveBeenCalled();
    expect(updateBundleMembersSpy).not.toHaveBeenCalled();

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('continues sync when individual skill operation fails', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-partial-${Date.now()}`, 'batch');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'alpha'), 'alpha', 'same-alpha');
    writeSkill(join(sourceDir, 'beta'), 'beta', 'same-beta');
    writeSkill(join(sourceDir, 'gamma'), 'gamma', 'new-gamma');

    writeSkill(join(testManagerDir, 'custom', 'batch', 'alpha'), 'alpha', 'same-alpha');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'beta'), 'beta', 'same-beta');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'gamma'), 'gamma', 'old-gamma');

    const sourcesService = new SourcesService();
    for (const skillName of ['alpha', 'beta', 'gamma']) {
      sourcesService.addSource(`custom/batch/${skillName}`, {
        url: sourceDir,
        type: 'custom',
        repoName: skillName,
        installMethod: 'local-copy',
      });
    }
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/batch/alpha', 'custom/batch/beta', 'custom/batch/gamma'],
    });

    const manager = new BundleManager(
      sourcesService,
      undefined as never,
      undefined as never,
      {
        fileExists: (path) => existsSync(path),
        readFileContent: (path) => {
          if (path === join(sourceDir, 'beta', 'SKILL.md')) {
            throw new Error('read failed');
          }
          return readFileSync(path, 'utf-8');
        },
        removeDir: (path) => {
          rmSync(path, { recursive: true, force: true });
        },
        getDirectoriesInDir: (dir) =>
          readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({
              name: entry.name,
              path: join(dir, entry.name),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
      },
    );

    const result = await manager.sync(bundleId, {});

    expect(result).toMatchObject({
      updated: 1,
      upToDate: 1,
      failed: 1,
      added: 0,
      addedSkipped: 0,
      removedKept: 0,
      removedHard: 0,
    });
    expect(readFileSync(join(testManagerDir, 'custom', 'batch', 'gamma', 'SKILL.md'), 'utf-8'))
      .toContain('new-gamma');
    expect(readFileSync(join(testManagerDir, 'custom', 'batch', 'beta', 'SKILL.md'), 'utf-8'))
      .toContain('same-beta');

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('throws when local-batch bundle source path does not exist', async () => {
    const sourceDir = '/nonexistent/path/that/should/not/exist';
    const bundleId = `local-batch:${sourceDir}`;
    const sourcesService = new SourcesService();

    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/batch/existing'],
    });

    const manager = new BundleManager(sourcesService);

    await expect(manager.sync(bundleId, {})).rejects.toThrow(/Bundle source path not found/);
  });

  it('local-batch sync adds new skill to same-name auto group when group exists', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-group-add-${Date.now()}`, 'tdd-spec');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(sourceDir, 'ts-new-one'), 'ts-new-one', 'ts-new-one');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply', 'ts-apply');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/ts-apply', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-apply',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
    });
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-apply');

    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(bundleId, {});

    expect(result.added).toBe(1);
    expect(groupsService.getGroup('tdd-spec')).toEqual([
      'custom/tdd-spec/ts-apply',
      'custom/tdd-spec/ts-new-one',
    ]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('local-batch sync skips group sync when same-name group does not exist', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-group-skip-${Date.now()}`, 'tdd-spec');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(sourceDir, 'ts-new-one'), 'ts-new-one', 'ts-new-one');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply', 'ts-apply');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/ts-apply', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-apply',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
    });

    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(bundleId, {});

    expect(result.added).toBe(1);
    expect(groupsService.getGroup('tdd-spec')).toBeNull();
    expect(sourcesService.getSource('custom/tdd-spec/ts-new-one')).toMatchObject({
      repoName: 'ts-new-one',
    });

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('local-batch sync appends multiple new skills to same-name auto group', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-group-multi-${Date.now()}`, 'tdd-spec');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(sourceDir, 'ts-debugging'), 'ts-debugging', 'ts-debugging');
    writeSkill(join(sourceDir, 'ts-ff-explore'), 'ts-ff-explore', 'ts-ff-explore');
    writeSkill(join(sourceDir, 'ts-ff-propose'), 'ts-ff-propose', 'ts-ff-propose');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply', 'ts-apply');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/ts-apply', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-apply',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
    });
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-apply');

    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(bundleId, {});

    expect(result.added).toBe(3);
    expect(groupsService.getGroup('tdd-spec')).toEqual([
      'custom/tdd-spec/ts-apply',
      'custom/tdd-spec/ts-debugging',
      'custom/tdd-spec/ts-ff-explore',
      'custom/tdd-spec/ts-ff-propose',
    ]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('local-batch sync does not touch group when source has no new skills', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-group-noop-${Date.now()}`, 'tdd-spec');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply', 'ts-apply');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/ts-apply', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-apply',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
    });
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-apply');

    const addSkillSpy = vi.spyOn(groupsService, 'addSkill');
    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(bundleId, {});

    expect(result.added).toBe(0);
    expect(result.upToDate).toBe(1);
    expect(addSkillSpy).not.toHaveBeenCalled();
    expect(groupsService.getGroup('tdd-spec')).toEqual(['custom/tdd-spec/ts-apply']);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('local-batch sync --sync removes skill from group via removeSkillFromAll', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-group-remove-${Date.now()}`, 'tdd-spec');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(sourceDir, 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-apply'), 'ts-apply', 'ts-apply');
    writeSkill(join(testManagerDir, 'custom', 'tdd-spec', 'ts-gone'), 'ts-gone', 'ts-gone');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/ts-apply', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-apply',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/tdd-spec/ts-gone', {
      url: sourceDir,
      type: 'custom',
      repoName: 'ts-gone',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply', 'custom/tdd-spec/ts-gone'],
    });
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-apply');
    groupsService.addSkill('tdd-spec', 'custom/tdd-spec/ts-gone');

    const manager = new BundleManager(sourcesService, undefined as never, groupsService);
    const result = await manager.sync(bundleId, { sync: true });

    expect(result.removedHard).toBe(1);
    expect(groupsService.getGroup('tdd-spec')).toEqual(['custom/tdd-spec/ts-apply']);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('remove handles pre-deleted member directory', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-bundle-remove-missing-${Date.now()}`, 'batch');
    const bundleId = `local-batch:${sourceDir}`;

    writeSkill(join(testManagerDir, 'custom', 'batch', 'alpha'), 'alpha', 'alpha');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'beta'), 'beta', 'beta');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/batch/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/batch/beta', {
      url: sourceDir,
      type: 'custom',
      repoName: 'beta',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(bundleId, {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/batch/alpha', 'custom/batch/beta'],
    });

    rmSync(join(testManagerDir, 'custom', 'batch', 'alpha'), { recursive: true, force: true });

    const manager = new BundleManager(sourcesService);
    const result = await manager.remove(bundleId);

    expect(result).toEqual({ removed: 2 });
    expect(sourcesService.getSource('custom/batch/alpha')).toBeUndefined();
    expect(sourcesService.getSource('custom/batch/beta')).toBeUndefined();
    expect(sourcesService.getBundle(bundleId)).toBeUndefined();
    expect(existsSync(join(testManagerDir, 'custom', 'batch', 'beta'))).toBe(false);
  });
});

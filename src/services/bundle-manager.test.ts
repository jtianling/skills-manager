import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { BundleManager } from './bundle-manager.js';
import { SourcesService } from './sources.js';

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

  function makeFakeRepo(skills: Array<{ name: string; content: string }>): {
    cloneRepo: ReturnType<typeof vi.fn>;
    scanSkills: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
  } {
    const fakeRepoDir = join(tmpdir(), `skillsmgr-fakerepo-${Date.now()}-${Math.random()}`);
    mkdirSync(fakeRepoDir, { recursive: true });
    const skillPaths = skills.map((s) => {
      const skillDir = join(fakeRepoDir, s.name);
      writeSkill(skillDir, s.name, s.content);
      return { name: s.name, path: skillDir };
    });
    const cleanup = vi.fn(() => rmSync(fakeRepoDir, { recursive: true, force: true }));
    const cloneRepo = vi.fn(async () => ({ repoPath: fakeRepoDir, cleanup }));
    const scanSkills = vi.fn(() => skillPaths);
    return { cloneRepo, scanSkills, cleanup };
  }

  it('syncs git bundle by cloning the repo (no GitHub API calls)', async () => {
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

    const fakeRepo = makeFakeRepo([{ name: 'commit', content: 'same' }]);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const manager = new BundleManager(
      sourcesService,
      undefined,
      undefined,
      undefined,
      fakeRepo.cloneRepo,
      fakeRepo.scanSkills,
    );
    const result = await manager.sync('git:https://github.com/anthropics/skills');

    expect(result.upToDate).toBe(1);
    expect(fakeRepo.cloneRepo).toHaveBeenCalledWith('https://github.com/anthropics/skills');
    expect(fakeRepo.cleanup).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('syncs git bundle when skills sit at repo root (each in own subdir)', async () => {
    const targetBase = join(testManagerDir, 'community', 'garrytan', 'gstack');
    writeSkill(join(targetBase, 'autoplan'), 'autoplan', 'old-autoplan');
    writeSkill(join(targetBase, 'checkpoint'), 'checkpoint', 'same');

    const sourcesService = new SourcesService();
    sourcesService.addSource('community/garrytan/gstack', {
      url: 'https://github.com/garrytan/gstack',
      type: 'community',
      repoName: 'gstack',
      installMethod: 'git',
    });
    sourcesService.addBundle('git:https://github.com/garrytan/gstack', {
      type: 'git',
      url: 'https://github.com/garrytan/gstack',
      selectionMode: 'all',
      members: ['community/garrytan/gstack'],
    });

    const fakeRepo = makeFakeRepo([
      { name: 'autoplan', content: 'new-autoplan' },
      { name: 'checkpoint', content: 'same' },
      { name: 'browse', content: 'fresh-browse' },
    ]);

    const manager = new BundleManager(
      sourcesService,
      undefined,
      undefined,
      undefined,
      fakeRepo.cloneRepo,
      fakeRepo.scanSkills,
    );
    const result = await manager.sync('git:https://github.com/garrytan/gstack');

    expect(result.updated).toBe(1);
    expect(result.upToDate).toBe(1);
    expect(result.added).toBe(1);
    expect(result.failed).toBe(0);

    expect(readFileSync(join(targetBase, 'autoplan', 'SKILL.md'), 'utf-8')).toContain('new-autoplan');
    expect(readFileSync(join(targetBase, 'browse', 'SKILL.md'), 'utf-8')).toContain('fresh-browse');
    expect(fakeRepo.cleanup).toHaveBeenCalled();
  });

  it('cleans up the temp clone even when sync throws', async () => {
    const sourcesService = new SourcesService();
    sourcesService.addBundle('git:https://github.com/foo/bar', {
      type: 'git',
      url: 'https://github.com/foo/bar',
      selectionMode: 'all',
      members: ['community/foo/bar'],
    });

    const cleanup = vi.fn();
    const cloneRepo = vi.fn(async () => ({ repoPath: '/nonexistent', cleanup }));
    const scanSkills = vi.fn(() => {
      throw new Error('scan blew up');
    });

    const manager = new BundleManager(
      sourcesService,
      undefined,
      undefined,
      undefined,
      cloneRepo,
      scanSkills,
    );

    await expect(manager.sync('git:https://github.com/foo/bar')).rejects.toThrow('scan blew up');
    expect(cleanup).toHaveBeenCalled();
  });

  it('rejects local-batch syncs and directs callers to physical groups', async () => {
    const sourcesService = new SourcesService();
    vi.spyOn(sourcesService, 'getBundle').mockReturnValue({
      type: 'local-batch',
      url: '/tmp/spec-tdd',
      selectionMode: 'all',
      members: ['custom/spec-tdd/alpha'],
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    const manager = new BundleManager(sourcesService);

    await expect(manager.sync('local-batch:/tmp/spec-tdd')).rejects.toThrow(
      'local-batch bundles are managed as physical groups. Use group update or update <group> instead.',
    );
  });

  it('rejects local-batch removals and directs callers to physical groups', async () => {
    const sourcesService = new SourcesService();
    vi.spyOn(sourcesService, 'getBundle').mockReturnValue({
      type: 'local-batch',
      url: '/tmp/spec-tdd',
      selectionMode: 'all',
      members: ['custom/spec-tdd/alpha'],
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    const manager = new BundleManager(sourcesService);

    await expect(manager.remove('local-batch:/tmp/spec-tdd')).rejects.toThrow(
      'local-batch bundles are managed as physical groups. Use group uninstall or uninstall <group> instead.',
    );
  });
});

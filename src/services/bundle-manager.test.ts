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

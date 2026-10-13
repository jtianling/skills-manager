import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../services/repo-clone.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/repo-clone.js')>();
  return { ...actual, cloneRepoToTemp: vi.fn() };
});

import * as constants from '../constants.js';
import { cloneRepoToTemp } from '../services/repo-clone.js';
import { GroupsService } from '../services/groups.js';
import { SourcesService } from '../services/sources.js';
import { SourceUpdater } from '../services/source-updater.js';
import { executeUpdateWithOptions } from './update.js';

describe('all-source repository bundle updates', () => {
  let managerDir: string;
  let sources: SourcesService;
  let remoteDirs: string[];
  let previousExitCode: typeof process.exitCode;

  function writeSkill(base: string, name: string, content = name): void {
    mkdirSync(join(base, name), { recursive: true });
    writeFileSync(join(base, name, 'SKILL.md'), content);
  }

  function addRepo(
    key: string,
    selectionMode: 'all' | 'subset' = 'all',
    installed = ['existing', 'gone'],
    remote = ['existing', 'new'],
  ): string {
    const url = `https://github.com/example/${key.split('/').pop()}`;
    sources.addSource(key, {
      url,
      type: key.startsWith('custom/') ? 'custom' : 'community',
      repoName: key.split('/').pop()!,
      installMethod: 'git',
    });
    sources.addBundle(`git:${url}`, {
      type: 'git', url, selectionMode, members: [key],
    });
    for (const name of installed) writeSkill(join(managerDir, key), name, 'old');
    const repoPath = mkdtempSync(join(tmpdir(), 'skillsmgr-remote-'));
    remoteDirs.push(repoPath);
    for (const name of remote) writeSkill(join(repoPath, 'skills'), name);
    const fallback = vi.mocked(cloneRepoToTemp).getMockImplementation();
    vi.mocked(cloneRepoToTemp).mockImplementation(async (source) => {
      if (source === url) {
        return { repoPath, commitSha: 'new-sha', cleanup: vi.fn() };
      }
      if (fallback) return fallback(source);
      throw new Error(`Unexpected clone: ${source}`);
    });
    return url;
  }

  beforeEach(() => {
    managerDir = mkdtempSync(join(tmpdir(), 'skillsmgr-update-all-'));
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: managerDir, writable: true,
    });
    sources = new SourcesService();
    remoteDirs = [];
    previousExitCode = process.exitCode;
    process.exitCode = 0;
    vi.mocked(cloneRepoToTemp).mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = previousExitCode;
    for (const dir of [managerDir, ...remoteDirs]) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('reconciles every git bundle once, including custom remote repos', async () => {
    const keys = ['official/anthropic/skills', 'community/example/tools', 'custom/remote'];
    const urls = keys.map((key) => addRepo(key));
    const groups = new GroupsService();
    groups.createGroup('favorites');
    for (const key of keys) groups.addSkill('favorites', `${key}/gone`);
    const before = groups.getGroup('favorites');
    expect(before?.kind === 'virtual' ? before.members.length : undefined)
      .toBe(keys.length);
    const updateSource = vi.spyOn(SourceUpdater.prototype, 'updateSource');

    await executeUpdateWithOptions(undefined, { sync: true });

    for (const key of keys) {
      expect(readFileSync(join(managerDir, key, 'existing/SKILL.md'), 'utf8'))
        .toBe('existing');
      expect(readFileSync(join(managerDir, key, 'new/SKILL.md'), 'utf8')).toBe('new');
      expect(existsSync(join(managerDir, key, 'gone'))).toBe(false);
      expect(sources.getSource(key)?.version).toBe('new-sha');
    }
    const after = groups.getGroup('favorites');
    expect(after?.kind === 'virtual' ? after.members : undefined).toEqual([]);
    expect(cloneRepoToTemp).toHaveBeenCalledTimes(urls.length);
    expect(updateSource).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      'Done! 3 updated, 3 added, 0 removed (kept), 3 removed, ' +
      '0 up to date, 0 failed, 0 skipped',
    );
  });

  it('adds full-repo members but keeps deleted members without --sync', async () => {
    const key = 'community/example/full';
    addRepo(key);

    await executeUpdateWithOptions();

    expect(existsSync(join(managerDir, key, 'new/SKILL.md'))).toBe(true);
    expect(readFileSync(join(managerDir, key, 'gone/SKILL.md'), 'utf8')).toBe('old');
    expect(console.log).toHaveBeenCalledWith(
      'Done! 1 updated, 1 added, 1 removed (kept), 0 removed, ' +
      '0 up to date, 0 failed, 0 skipped',
    );
  });

  it('preserves subset selection while pruning selected members with --sync', async () => {
    const key = 'community/example/subset';
    addRepo(key, 'subset');

    await executeUpdateWithOptions(undefined, { sync: true });

    expect(readFileSync(join(managerDir, key, 'existing/SKILL.md'), 'utf8'))
      .toBe('existing');
    expect(existsSync(join(managerDir, key, 'new'))).toBe(false);
    expect(existsSync(join(managerDir, key, 'gone'))).toBe(false);
    expect(sources.getBundle('git:https://github.com/example/subset')?.selectionMode)
      .toBe('subset');
    expect(console.log).toHaveBeenCalledWith(
      'Done! 1 updated, 0 added, 0 removed (kept), 1 removed, ' +
      '0 up to date, 0 failed, 1 skipped',
    );
  });

  it('leaves standalone custom skills and local physical groups untouched', async () => {
    addRepo('community/example/full');
    writeSkill(join(managerDir, 'custom'), 'standalone', 'local standalone');
    writeSkill(join(managerDir, 'custom/local-group'), 'member', 'local member');
    const groups = new GroupsService();
    groups.createLocalBatchGroup('local-group', '/missing/local-group');
    sources.addSource('custom/local-group/member', {
      url: '/missing/local-group', type: 'custom', repoName: 'member',
      installMethod: 'local-copy',
    });
    const before = readFileSync(join(managerDir, 'groups.json'), 'utf8');

    await executeUpdateWithOptions(undefined, { sync: true });

    expect(readFileSync(join(managerDir, 'custom/standalone/SKILL.md'), 'utf8'))
      .toBe('local standalone');
    expect(readFileSync(join(managerDir, 'custom/local-group/member/SKILL.md'), 'utf8'))
      .toBe('local member');
    expect(readFileSync(join(managerDir, 'groups.json'), 'utf8')).toBe(before);
    expect(cloneRepoToTemp).toHaveBeenCalledTimes(1);
  });

  it('still updates unbundled sources through SourceUpdater', async () => {
    addRepo('community/example/full');
    const url = addRepo('community/example/unbundled');
    sources.removeBundle(`git:${url}`);
    sources.addSource('registry/package', {
      url: 'https://registry.test/package', type: 'registry', repoName: 'package',
      installMethod: 'registry',
    });
    sources.addSource('custom/archive', {
      url: '/tmp/archive.zip', type: 'custom', repoName: 'archive',
      installMethod: 'zip',
    });
    const registryUpdate = vi.spyOn(SourceUpdater.prototype, 'updateRegistrySource')
      .mockResolvedValue({ updated: 1, upToDate: 0, failed: 0, skipped: 0 });
    const updateSource = vi.spyOn(SourceUpdater.prototype, 'updateSource');

    await executeUpdateWithOptions(undefined, { sync: true });

    expect(updateSource.mock.calls.map(([key]) => key))
      .toEqual(['community/example/unbundled', 'registry/package', 'custom/archive']);
    expect(registryUpdate).toHaveBeenCalledOnce();
    expect(existsSync(join(managerDir, 'community/example/unbundled/new'))).toBe(false);
    expect(existsSync(join(managerDir, 'community/example/unbundled/gone'))).toBe(true);
  });

  it('reports a failed clone, keeps local data, and continues other updates', async () => {
    const failedUrl = addRepo('community/example/failed');
    addRepo('community/example/healthy');
    const fallback = vi.mocked(cloneRepoToTemp).getMockImplementation()!;
    vi.mocked(cloneRepoToTemp).mockImplementation(async (url) => {
      if (url === failedUrl) throw new Error('clone unavailable');
      return fallback(url);
    });

    await executeUpdateWithOptions(undefined, { sync: true });

    expect(process.exitCode).toBe(1);
    expect(existsSync(join(managerDir, 'community/example/failed/gone'))).toBe(true);
    expect(existsSync(join(managerDir, 'community/example/healthy/new'))).toBe(true);
    expect(cloneRepoToTemp).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith('  ✗ Failed to sync bundle: clone unavailable');
  });

  it('reconciles a tracked bundle even when its source record is absent', async () => {
    const key = 'community/example/full';
    addRepo(key);
    sources.removeSource(key);

    await executeUpdateWithOptions(undefined, { sync: true });

    expect(existsSync(join(managerDir, key, 'new/SKILL.md'))).toBe(true);
    expect(existsSync(join(managerDir, key, 'gone'))).toBe(false);
    expect(cloneRepoToTemp).toHaveBeenCalledOnce();
  });
});

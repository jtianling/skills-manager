import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { GitHubService } from './github.js';
import { GroupsService } from './groups.js';
import { RegistryService } from './registry.js';
import { SourceInfo, SourcesService } from './sources.js';
import { SourceUpdater } from './source-updater.js';

function gitSourceInfo(url: string, repoName: string, type: 'community' | 'official' | 'custom' = 'community'): SourceInfo {
  return {
    url,
    type,
    repoName,
    installMethod: 'git',
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function writeSkill(path: string, name: string, body = name): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'SKILL.md'), `---\nname: ${name}\n---\n${body}`);
}

describe('SourceUpdater git source updates', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-source-updater-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setupRemoteClone(skills: Array<{ name: string; body?: string; extraFile?: { name: string; content: string } }>): {
    repoPath: string;
    cleanupSpy: ReturnType<typeof vi.fn>;
    cloneRepo: ReturnType<typeof vi.fn>;
    scanSkills: ReturnType<typeof vi.fn>;
    tempRoot: string;
  } {
    const tempRoot = join(tmpdir(), `skillsmgr-remote-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const repoPath = join(tempRoot, 'repo');
    mkdirSync(repoPath, { recursive: true });
    for (const skill of skills) {
      const skillDir = join(repoPath, 'skills', skill.name);
      writeSkill(skillDir, skill.name, skill.body ?? skill.name);
      if (skill.extraFile) {
        writeFileSync(join(skillDir, skill.extraFile.name), skill.extraFile.content);
      }
    }
    const cleanupSpy = vi.fn(() => rmSync(tempRoot, { recursive: true, force: true }));
    const cloneRepo = vi.fn(async () => ({ repoPath, cleanup: cleanupSpy }));
    const scanSkills = vi.fn((rp: string) =>
      skills.map((s) => ({ name: s.name, path: join(rp, 'skills', s.name) })),
    );
    return { repoPath, cleanupSpy, cloneRepo, scanSkills, tempRoot };
  }

  function makeUpdater(
    cloneRepo: (url: string) => Promise<{ repoPath: string; cleanup(): void }>,
    scanSkills: (repoPath: string) => Array<{ name: string; path: string }>,
  ): SourceUpdater {
    return new SourceUpdater(
      new SourcesService(),
      new GitHubService(),
      new RegistryService(),
      new GroupsService(),
      cloneRepo,
      scanSkills,
    );
  }

  it('reports up to date when SKILL.md bytes match (no recopy)', async () => {
    const installed = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    writeSkill(installed, 'alpha', 'same body');

    const fixture = setupRemoteClone([{ name: 'alpha', body: 'same body' }]);
    const updater = makeUpdater(fixture.cloneRepo, fixture.scanSkills);

    const sourcesService = new SourcesService();
    sourcesService.addSource('community/obra/superpowers', {
      url: 'https://github.com/obra/superpowers',
      type: 'community',
      repoName: 'superpowers',
      installMethod: 'git',
    });

    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    expect(result.upToDate).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
    expect(fixture.cleanupSpy).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('  ✓ alpha: up to date');
  });

  it('copies entire skill dir when SKILL.md differs (refreshes non-SKILL.md files)', async () => {
    const installed = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    writeSkill(installed, 'alpha', 'old body');
    writeFileSync(join(installed, 'helper.txt'), 'old helper');

    const fixture = setupRemoteClone([
      {
        name: 'alpha',
        body: 'new body',
        extraFile: { name: 'helper.txt', content: 'new helper' },
      },
    ]);
    const updater = makeUpdater(fixture.cloneRepo, fixture.scanSkills);

    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    expect(result.updated).toBe(1);
    expect(result.upToDate).toBe(0);
    expect(readFileSync(join(installed, 'SKILL.md'), 'utf-8')).toContain('new body');
    expect(readFileSync(join(installed, 'helper.txt'), 'utf-8')).toBe('new helper');
    expect(fixture.cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('reports "not found in remote" when local skill is missing from clone, does not delete it', async () => {
    const aliveDir = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    const orphanDir = join(testManagerDir, 'community', 'obra', 'superpowers', 'gone');
    writeSkill(aliveDir, 'alpha');
    writeSkill(orphanDir, 'gone', 'preserved body');

    const fixture = setupRemoteClone([{ name: 'alpha' }]);
    const updater = makeUpdater(fixture.cloneRepo, fixture.scanSkills);

    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    expect(result.failed).toBe(1);
    expect(console.log).toHaveBeenCalledWith('  ⚠ gone: not found in remote');
    expect(existsSync(join(orphanDir, 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(orphanDir, 'SKILL.md'), 'utf-8')).toContain('preserved body');
  });

  it('isolates per-skill failures and continues processing the rest', async () => {
    const alpha = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    const beta = join(testManagerDir, 'community', 'obra', 'superpowers', 'beta');
    const gamma = join(testManagerDir, 'community', 'obra', 'superpowers', 'gamma');
    writeSkill(alpha, 'alpha', 'old-alpha');
    writeSkill(beta, 'beta', 'old-beta');
    writeSkill(gamma, 'gamma', 'old-gamma');

    const fixture = setupRemoteClone([
      { name: 'alpha', body: 'new-alpha' },
      { name: 'beta', body: 'new-beta' },
      { name: 'gamma', body: 'new-gamma' },
    ]);

    // Sabotage just beta's remote SKILL.md to be unreadable: replace the file
    // with an empty directory at the same path. readFileContent on a directory
    // throws EISDIR — exactly the kind of mid-loop IO error this isolates.
    rmSync(join(fixture.repoPath, 'skills', 'beta', 'SKILL.md'));
    mkdirSync(join(fixture.repoPath, 'skills', 'beta', 'SKILL.md'));

    const updater = makeUpdater(fixture.cloneRepo, fixture.scanSkills);
    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    expect(result.failed).toBe(1);
    expect(result.updated).toBe(2);
    expect(readFileSync(join(alpha, 'SKILL.md'), 'utf-8')).toContain('new-alpha');
    expect(readFileSync(join(gamma, 'SKILL.md'), 'utf-8')).toContain('new-gamma');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^  ✗ beta: failed to update \(/),
    );
  });

  it('does not delete any local skill when cloneRepo throws, propagates the error', async () => {
    const installed = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    writeSkill(installed, 'alpha', 'untouched');

    const cloneRepo = vi.fn(async () => {
      throw new Error('clone failed: network down');
    });
    const scanSkills = vi.fn();
    const updater = makeUpdater(cloneRepo, scanSkills);

    await expect(
      updater.updateSource(
        'community/obra/superpowers',
        gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
      ),
    ).rejects.toThrow('clone failed: network down');

    expect(scanSkills).not.toHaveBeenCalled();
    expect(existsSync(join(installed, 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(installed, 'SKILL.md'), 'utf-8')).toContain('untouched');
  });

  it('runs cleanup when scanSkills throws (no temp dir leak)', async () => {
    const installed = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    writeSkill(installed, 'alpha');

    const tempRoot = join(tmpdir(), `skillsmgr-scanfail-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const repoPath = join(tempRoot, 'repo');
    mkdirSync(repoPath, { recursive: true });
    const cleanupSpy = vi.fn(() => rmSync(tempRoot, { recursive: true, force: true }));
    const cloneRepo = vi.fn(async () => ({ repoPath, cleanup: cleanupSpy }));
    const scanSkills = vi.fn(() => {
      throw new Error('scan blew up');
    });

    const updater = makeUpdater(cloneRepo, scanSkills);

    await expect(
      updater.updateSource(
        'community/obra/superpowers',
        gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
      ),
    ).rejects.toThrow('scan blew up');

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('skips "commands" directory and respects selectedSkillNames', async () => {
    const installedAlpha = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    const installedBeta = join(testManagerDir, 'community', 'obra', 'superpowers', 'beta');
    const commandsDir = join(testManagerDir, 'community', 'obra', 'superpowers', 'commands');
    writeSkill(installedAlpha, 'alpha', 'old');
    writeSkill(installedBeta, 'beta', 'old');
    mkdirSync(commandsDir, { recursive: true });
    writeFileSync(join(commandsDir, 'SKILL.md'), 'should not be touched');

    const fixture = setupRemoteClone([
      { name: 'alpha', body: 'new' },
      { name: 'beta', body: 'new' },
      { name: 'commands', body: 'remote' },
    ]);
    const updater = makeUpdater(fixture.cloneRepo, fixture.scanSkills);

    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
      { selectedSkillNames: new Set(['alpha']) },
    );

    expect(result.updated).toBe(1);
    expect(readFileSync(join(installedAlpha, 'SKILL.md'), 'utf-8')).toContain('new');
    expect(readFileSync(join(installedBeta, 'SKILL.md'), 'utf-8')).toContain('old');
    expect(readFileSync(join(commandsDir, 'SKILL.md'), 'utf-8')).toBe('should not be touched');
  });

  it('updates source timestamp after successful clone-based update', async () => {
    const installed = join(testManagerDir, 'community', 'obra', 'superpowers', 'alpha');
    writeSkill(installed, 'alpha');

    const sourcesService = new SourcesService();
    sourcesService.addSource('community/obra/superpowers', {
      url: 'https://github.com/obra/superpowers',
      type: 'community',
      repoName: 'superpowers',
      installMethod: 'git',
    });
    const before = sourcesService.getSource('community/obra/superpowers')?.updatedAt;

    const fixture = setupRemoteClone([{ name: 'alpha' }]);
    const updater = new SourceUpdater(
      sourcesService,
      new GitHubService(),
      new RegistryService(),
      new GroupsService(),
      fixture.cloneRepo,
      fixture.scanSkills,
    );

    await new Promise((r) => setTimeout(r, 5));
    await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    const after = sourcesService.getSource('community/obra/superpowers')?.updatedAt;
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });

  it('returns empty result and does not clone when no local skills installed', async () => {
    const cloneRepo = vi.fn();
    const scanSkills = vi.fn();
    const updater = makeUpdater(
      cloneRepo as unknown as (url: string) => Promise<{ repoPath: string; cleanup(): void }>,
      scanSkills as unknown as (repoPath: string) => Array<{ name: string; path: string }>,
    );

    const result = await updater.updateSource(
      'community/obra/superpowers',
      gitSourceInfo('https://github.com/obra/superpowers', 'superpowers'),
    );

    expect(result).toEqual({ updated: 0, upToDate: 0, failed: 0, skipped: 0 });
    expect(cloneRepo).not.toHaveBeenCalled();
    expect(scanSkills).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('  No skills installed locally');
  });

  it('skips zip sources without cloning', async () => {
    const cloneRepo = vi.fn();
    const scanSkills = vi.fn();
    const updater = makeUpdater(
      cloneRepo as unknown as (url: string) => Promise<{ repoPath: string; cleanup(): void }>,
      scanSkills as unknown as (repoPath: string) => Array<{ name: string; path: string }>,
    );

    const zipInfo: SourceInfo = {
      url: '/tmp/zip-skill.zip',
      type: 'custom',
      repoName: 'zip-skill',
      installMethod: 'zip',
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const result = await updater.updateSource('custom/zip-skill', zipInfo);

    expect(result.skipped).toBe(1);
    expect(cloneRepo).not.toHaveBeenCalled();
  });

  it('warns and returns empty when GitHub URL cannot be parsed', async () => {
    const cloneRepo = vi.fn();
    const scanSkills = vi.fn();
    const updater = makeUpdater(
      cloneRepo as unknown as (url: string) => Promise<{ repoPath: string; cleanup(): void }>,
      scanSkills as unknown as (repoPath: string) => Array<{ name: string; path: string }>,
    );

    const result = await updater.updateSource(
      'community/x/y',
      gitSourceInfo('not-a-github-url', 'y'),
    );

    expect(result).toEqual({ updated: 0, upToDate: 0, failed: 0, skipped: 0 });
    expect(cloneRepo).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('  ⚠ Cannot parse URL: not-a-github-url');
  });
});

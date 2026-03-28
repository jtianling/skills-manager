import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../services/github.js', () => {
  class GitHubService {
    parseGitHubUrl(url: string) {
      const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (!match) {
        return null;
      }

      return {
        owner: match[1],
        repo: match[2],
      };
    }

    async getDefaultBranch() {
      return 'main';
    }

    async listSkills() {
      return [{ name: 'grouped-skill', path: 'skills/grouped-skill' }];
    }

    async fetchRootFile() {
      return null;
    }

    async downloadSkill() {
      return;
    }

    async downloadRepoRoot() {
      return;
    }
  }

  return { GitHubService };
});

import * as constants from '../constants.js';
import { SourcesService } from '../services/sources.js';
import { executeUpdate } from './update.js';

describe('update command', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-update-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips zip sources', async () => {
    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/zip-skill', {
      url: '/tmp/zip-skill.zip',
      type: 'custom',
      repoName: 'zip-skill',
      installMethod: 'zip',
    });

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('  Skipping zip-skill: installed from zip, manual reinstall required');
    expect(console.log).toHaveBeenCalledWith('Done! 0 updated, 0 up to date, 0 failed, 1 skipped');
  });

  it('updates local-copy source when original path has changes', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-${Date.now()}`);
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/my-skill', {
      url: originalDir,
      type: 'custom',
      repoName: 'my-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('  ↑ my-skill: updated');
    const updated = readFileSync(join(installedDir, 'SKILL.md'), 'utf-8');
    expect(updated).toBe('new content');

    rmSync(originalDir, { recursive: true, force: true });
  });

  it('reports up to date for local-copy source with no changes', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-${Date.now()}`);
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'same content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'same content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/my-skill', {
      url: originalDir,
      type: 'custom',
      repoName: 'my-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('  ✓ my-skill: up to date');

    rmSync(originalDir, { recursive: true, force: true });
  });

  it('reports failure when local-copy original path does not exist', async () => {
    const installedDir = join(testManagerDir, 'custom', 'gone-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/gone-skill', {
      url: '/nonexistent/path',
      type: 'custom',
      repoName: 'gone-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('  ⚠ gone-skill: original path not found: /nonexistent/path');
  });

  it('updates local-copy source by path argument (name-based matching)', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-path-${Date.now()}`, 'path-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'updated content');

    const installedDir = join(testManagerDir, 'custom', 'path-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/path-skill', {
      url: '/old/path/path-skill',
      type: 'custom',
      repoName: 'path-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ↑ path-skill: updated');

    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['custom/path-skill'].url).toBe(originalDir);

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('updates from different CWD by matching skill name', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-diffcwd-${Date.now()}`, 'my-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/my-skill', {
      url: '/original/install/path/my-skill',
      type: 'custom',
      repoName: 'my-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ↑ my-skill: updated');

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('reports not found when source path does not exist', async () => {
    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/dummy', {
      url: '/dummy',
      type: 'custom',
      repoName: 'dummy',
      installMethod: 'local-copy',
    });

    await executeUpdate('/nonexistent/path/some-skill');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Source path not found'));
  });

  it('reports not found when skill is not installed', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-notinstalled-${Date.now()}`, 'unknown-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'content');

    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/other-skill', {
      url: '/some/path',
      type: 'custom',
      repoName: 'other-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('No installed skill found: unknown-skill');

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('creates sources.json entry when none exists for update by path', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-nosource-${Date.now()}`, 'orphan-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'orphan-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/dummy', {
      url: '/dummy',
      type: 'custom',
      repoName: 'dummy',
      installMethod: 'local-copy',
    });

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ↑ orphan-skill: updated');

    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['custom/orphan-skill']).toMatchObject({
      url: originalDir,
      type: 'custom',
      installMethod: 'local-copy',
    });

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('updates custom git installs stored as per-skill source keys', async () => {
    const customDir = join(testManagerDir, 'custom', 'grouped-skill');
    mkdirSync(customDir, { recursive: true });
    writeFileSync(join(customDir, 'SKILL.md'), '---\nname: grouped-skill\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/grouped-skill', {
      url: 'https://github.com/owner/repo',
      type: 'custom',
      repoName: 'repo',
      installMethod: 'git',
    });

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (String(input).includes('/skills/grouped-skill/SKILL.md')) {
        return {
          ok: true,
          text: async () => '---\nname: grouped-skill\n---\n',
        };
      }

      throw new Error(`Unexpected fetch: ${input}`);
    }));

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('  ✓ grouped-skill: up to date');

    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['custom/grouped-skill'].installMethod).toBe('git');
  });
});

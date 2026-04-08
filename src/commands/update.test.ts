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

    async listSkillsWithFallbackPaths() {
      return {
        skillsPath: 'skills',
        skills: [{ name: 'grouped-skill', path: 'skills/grouped-skill' }],
      };
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

vi.mock('../services/registry.js', () => {
  class RegistryService {
    async getPackument(name: string) {
      return {
        'dist-tags': { latest: '2.0.0' },
        versions: {
          '1.2.0': {
            dist: { tarball: `https://registry.test/${name}/1.2.0.tgz` },
          },
          '2.0.0': {
            dist: { tarball: `https://registry.test/${name}/2.0.0.tgz` },
          },
        },
      };
    }

    async downloadTarball(_url: string, destDir: string) {
      mkdirSync(destDir, { recursive: true });
      writeFileSync(join(destDir, 'SKILL.md'), 'registry content');
    }
  }

  return { RegistryService };
});

import * as constants from '../constants.js';
import { SourcesService } from '../services/sources.js';
import { executeUpdate, executeUpdateWithOptions } from './update.js';

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

  it('updates local-copy source by tracked path argument', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-path-${Date.now()}`, 'path-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'updated content');

    const installedDir = join(testManagerDir, 'custom', 'path-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/path-skill', {
      url: originalDir,
      type: 'custom',
      repoName: 'path-skill',
      installMethod: 'local-copy',
    });

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ↑ path-skill: updated');

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('reports not found for untracked local path even if skill name matches', async () => {
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

    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${originalDir}`
    );

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

    expect(console.log).toHaveBeenCalledWith('No installed skill found from path: /nonexistent/path/some-skill');
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

    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${originalDir}`
    );

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('does not create sources.json entry for untracked local path', async () => {
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

    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${originalDir}`
    );

    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['custom/orphan-skill']).toBeUndefined();

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

  it('updates official source via owner alias input', async () => {
    const installedDir = join(testManagerDir, 'official', 'anthropic', 'skills', 'commit');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), '---\nname: commit\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('official/anthropic/skills', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'skills',
      installMethod: 'git',
    });

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (String(input).includes('/skills/commit/SKILL.md')) {
        return { ok: true, text: async () => '---\nname: commit\n---\n' };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    }));

    await executeUpdate('anthropics/skills');

    expect(console.log).toHaveBeenCalledWith('Updating official/anthropic/skills...\n');
    expect(console.log).toHaveBeenCalledWith('  ✓ commit: up to date');
  });

  it('updates source via repository URL input', async () => {
    const installedDir = join(testManagerDir, 'community', 'obra', 'superpowers', 'grouped-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), '---\nname: grouped-skill\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('community/obra/superpowers', {
      url: 'https://github.com/obra/superpowers',
      type: 'community',
      repoName: 'superpowers',
      installMethod: 'git',
    });

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (String(input).includes('/skills/grouped-skill/SKILL.md')) {
        return { ok: true, text: async () => '---\nname: grouped-skill\n---\n' };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    }));

    await executeUpdate('https://github.com/obra/superpowers');

    expect(console.log).toHaveBeenCalledWith('Updating community/obra/superpowers...\n');
    expect(console.log).toHaveBeenCalledWith('  ✓ grouped-skill: up to date');
  });

  it('updates registry source to requested version', async () => {
    const installedDir = join(testManagerDir, 'registry', 'code-review');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old registry content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('registry/code-review', {
      url: 'https://skillsmgr.dev/api/r/code-review',
      type: 'registry',
      repoName: 'code-review',
      installMethod: 'registry',
      version: '1.0.0',
    });

    await executeUpdate('code-review@1.2.0');

    expect(console.log).toHaveBeenCalledWith('  ↑ code-review: 1.0.0 → 1.2.0');
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['registry/code-review'].version).toBe('1.2.0');
  });

  it('syncs local batch bundle when updating by batch path', async () => {
    const batchDir = join(tmpdir(), `skillsmgr-batch-${Date.now()}`, 'spec-tdd');
    mkdirSync(join(batchDir, 'skill-a'), { recursive: true });
    mkdirSync(join(batchDir, 'skill-b'), { recursive: true });
    writeFileSync(join(batchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
    writeFileSync(join(batchDir, 'skill-b', 'SKILL.md'), '---\nname: skill-b\n---\n');

    const installedDir = join(testManagerDir, 'custom', 'spec-tdd');
    mkdirSync(join(installedDir, 'skill-a'), { recursive: true });
    writeFileSync(join(installedDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/spec-tdd/skill-a', {
      url: batchDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(`local-batch:${batchDir}`, {
      type: 'local-batch',
      url: batchDir,
      selectionMode: 'all',
      members: ['custom/spec-tdd/skill-a'],
    });

    await executeUpdateWithOptions(batchDir);

    expect(console.log).toHaveBeenCalledWith(`Updating local-batch:${batchDir}...\n`);
    expect(console.log).toHaveBeenCalledWith('  + skill-b: new in source (installed)');
    expect(console.log).toHaveBeenCalledWith('  ✓ 1 skills up to date');
    expect(console.log).toHaveBeenCalledWith(
      '\nDone! 0 updated, 1 added, 0 removed (kept), 0 removed, 1 up to date, 0 failed'
    );
    expect(readFileSync(join(installedDir, 'skill-b', 'SKILL.md'), 'utf-8')).toContain('skill-b');

    rmSync(join(batchDir, '..'), { recursive: true, force: true });
  });

  it('syncs git bundle when updating by owner/repo input', async () => {
    const installedDir = join(testManagerDir, 'official', 'anthropic', 'skills', 'grouped-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), '---\nname: grouped-skill\n---\n');

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

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (String(input).includes('/skills/grouped-skill/SKILL.md')) {
        return { ok: true, text: async () => '---\nname: grouped-skill\n---\n' };
      }

      throw new Error(`Unexpected fetch: ${input}`);
    }));

    await executeUpdateWithOptions('anthropics/skills');

    expect(console.log).toHaveBeenCalledWith('Updating git:https://github.com/anthropics/skills...\n');
    expect(console.log).toHaveBeenCalledWith('  ✓ 1 skills up to date');
    expect(console.log).toHaveBeenCalledWith(
      '\nDone! 0 updated, 0 added, 0 removed (kept), 0 removed, 1 up to date, 0 failed'
    );
  });

  it('reports not found for untracked batch directory path', async () => {
    const batchDir = join(tmpdir(), `skillsmgr-batch-missing-${Date.now()}`, 'spec-tdd');
    mkdirSync(join(batchDir, 'skill-a'), { recursive: true });
    writeFileSync(join(batchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/dummy', {
      url: '/dummy',
      type: 'custom',
      repoName: 'dummy',
      installMethod: 'local-copy',
    });

    await executeUpdate(batchDir);
    expect(console.log).toHaveBeenCalledWith(`No installed skill found from path: ${batchDir}`);

    rmSync(join(batchDir, '..'), { recursive: true, force: true });
  });
});

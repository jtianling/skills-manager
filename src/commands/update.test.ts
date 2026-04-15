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

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
}));

import * as constants from '../constants.js';
import { SourcesService } from '../services/sources.js';
import { makeBundleId } from '../utils/url-normalize.js';
import { promptConfirm } from '../utils/prompts.js';
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
    vi.mocked(promptConfirm).mockResolvedValue(true);
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

  it('rebinds a moved batch bundle after confirmation and continues update', async () => {
    const oldBatchDir = join(tmpdir(), `skillsmgr-old-batch-${Date.now()}`, 'tdd-spec');
    const newBatchDir = join(tmpdir(), `skillsmgr-new-batch-${Date.now()}`, 'tdd-spec');
    mkdirSync(join(newBatchDir, 'skill-a'), { recursive: true });
    mkdirSync(join(newBatchDir, 'skill-b'), { recursive: true });
    writeFileSync(join(newBatchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
    writeFileSync(join(newBatchDir, 'skill-b', 'SKILL.md'), '---\nname: skill-b\n---\n');

    const installedDir = join(testManagerDir, 'custom', 'tdd-spec');
    mkdirSync(join(installedDir, 'skill-a'), { recursive: true });
    writeFileSync(join(installedDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

    const sourcesService = new SourcesService();
    const oldBundleId = makeBundleId('local-batch', oldBatchDir);
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldBatchDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(oldBundleId, {
      type: 'local-batch',
      url: oldBatchDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/skill-a'],
    });

    await executeUpdateWithOptions(newBatchDir);

    expect(promptConfirm).toHaveBeenCalledWith(
      expect.stringContaining(`Old path: ${oldBatchDir}`),
      false,
    );
    expect(console.log).toHaveBeenCalledWith('  + skill-b: new in source (installed)');
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    const newBundleId = makeBundleId('local-batch', newBatchDir);
    expect(sourcesData.bundles[oldBundleId]).toBeUndefined();
    expect(sourcesData.bundles[newBundleId]).toMatchObject({
      url: newBatchDir,
      members: ['custom/tdd-spec/skill-a', 'custom/tdd-spec/skill-b'],
    });
    expect(sourcesData.sources['custom/tdd-spec/skill-a'].url).toBe(newBatchDir);
    expect(readFileSync(join(installedDir, 'skill-b', 'SKILL.md'), 'utf-8')).toContain('skill-b');

    rmSync(join(newBatchDir, '..'), { recursive: true, force: true });
  });

  it('cancels rebind when the user declines the prompt', async () => {
    const oldBatchDir = join(tmpdir(), `skillsmgr-old-batch-${Date.now()}`, 'tdd-spec');
    const newBatchDir = join(tmpdir(), `skillsmgr-new-batch-${Date.now()}`, 'tdd-spec');
    mkdirSync(join(newBatchDir, 'skill-a'), { recursive: true });
    writeFileSync(join(newBatchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
    vi.mocked(promptConfirm).mockResolvedValueOnce(false);

    const sourcesService = new SourcesService();
    const oldBundleId = makeBundleId('local-batch', oldBatchDir);
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldBatchDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(oldBundleId, {
      type: 'local-batch',
      url: oldBatchDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/skill-a'],
    });

    await executeUpdateWithOptions(newBatchDir);

    expect(console.log).toHaveBeenCalledWith('Cancelled.');
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.bundles[oldBundleId]).toBeDefined();
    expect(sourcesData.bundles[makeBundleId('local-batch', newBatchDir)]).toBeUndefined();

    rmSync(join(newBatchDir, '..'), { recursive: true, force: true });
  });

  it('rebinds without prompting when --force is used', async () => {
    const oldDir = join(tmpdir(), `skillsmgr-old-force-${Date.now()}`, 'my-skill');
    const newDir = join(tmpdir(), `skillsmgr-new-force-${Date.now()}`, 'my-skill');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/my-skill', {
      url: oldDir,
      type: 'custom',
      repoName: 'my-skill',
      installMethod: 'local-copy',
    });

    await executeUpdateWithOptions(newDir, { force: true });

    expect(promptConfirm).not.toHaveBeenCalled();
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(sourcesData.sources['custom/my-skill'].url).toBe(newDir);
    expect(readFileSync(join(installedDir, 'SKILL.md'), 'utf-8')).toBe('new content');

    rmSync(join(newDir, '..'), { recursive: true, force: true });
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

  it('reports a specific reason when the old path still exists', async () => {
    const oldDir = join(tmpdir(), `skillsmgr-old-exists-${Date.now()}`, 'tdd-spec');
    const newDir = join(tmpdir(), `skillsmgr-new-exists-${Date.now()}`, 'tdd-spec');
    mkdirSync(join(oldDir, 'skill-a'), { recursive: true });
    mkdirSync(join(newDir, 'skill-a'), { recursive: true });
    writeFileSync(join(oldDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
    writeFileSync(join(newDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', oldDir), {
      type: 'local-batch',
      url: oldDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/skill-a'],
    });

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      'Hint: The old path still exists. Remove or rename the old directory before running update again.',
    );
    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${newDir}. ` +
      `A bundle with the same name is installed from ${oldDir} ` +
      '(still exists). Remove or rename the old path first to rebind.',
    );

    rmSync(join(oldDir, '..'), { recursive: true, force: true });
    rmSync(join(newDir, '..'), { recursive: true, force: true });
  });

  it('reports path type mismatch for rebind candidates', async () => {
    const oldDir = join(tmpdir(), `skillsmgr-old-mismatch-${Date.now()}`, 'tdd-spec');
    const newDir = join(tmpdir(), `skillsmgr-new-mismatch-${Date.now()}`, 'tdd-spec');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, 'SKILL.md'), '---\nname: tdd-spec\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', oldDir), {
      type: 'local-batch',
      url: oldDir,
      selectionMode: 'all',
      members: ['custom/tdd-spec/skill-a'],
    });

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      `Path type mismatch: existing bundle 'tdd-spec' is batch, ` +
      `but ${newDir} looks like a single skill.`,
    );

    rmSync(join(newDir, '..'), { recursive: true, force: true });
  });

  it('reports all matching rebind candidates when basename is ambiguous', async () => {
    const oldDirA = join(tmpdir(), `skillsmgr-old-a-${Date.now()}`, 'tdd-spec');
    const oldDirB = join(tmpdir(), `skillsmgr-old-b-${Date.now()}`, 'tdd-spec');
    const newDir = join(tmpdir(), `skillsmgr-new-ambiguous-${Date.now()}`, 'tdd-spec');
    mkdirSync(join(newDir, 'skill-a'), { recursive: true });
    writeFileSync(join(newDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/tdd-spec/a', {
      url: oldDirA,
      type: 'custom',
      repoName: 'a',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/tdd-spec/b', {
      url: oldDirB,
      type: 'custom',
      repoName: 'b',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', oldDirA), {
      type: 'local-batch',
      url: oldDirA,
      selectionMode: 'all',
      members: ['custom/tdd-spec/a'],
    });
    sourcesService.addBundle(makeBundleId('local-batch', oldDirB), {
      type: 'local-batch',
      url: oldDirB,
      selectionMode: 'all',
      members: ['custom/tdd-spec/b'],
    });

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${newDir}. ` +
      "Multiple installed local sources share basename 'tdd-spec':\n" +
      `  - ${makeBundleId('local-batch', oldDirA)}: ${oldDirA}\n` +
      `  - ${makeBundleId('local-batch', oldDirB)}: ${oldDirB}`,
    );

    rmSync(join(newDir, '..'), { recursive: true, force: true });
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

  it('prints refresh reminder when bundle has new skills', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-update-reminder-${Date.now()}`, 'reminder-batch');
    mkdirSync(join(sourceDir, 'existing'), { recursive: true });
    mkdirSync(join(sourceDir, 'new-one'), { recursive: true });
    writeFileSync(join(sourceDir, 'existing', 'SKILL.md'), '---\nname: existing\n---\n');
    writeFileSync(join(sourceDir, 'new-one', 'SKILL.md'), '---\nname: new-one\n---\n');

    mkdirSync(join(testManagerDir, 'custom', 'reminder-batch', 'existing'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'custom', 'reminder-batch', 'existing', 'SKILL.md'),
      '---\nname: existing\n---\n',
    );

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/reminder-batch/existing', {
      url: sourceDir,
      type: 'custom',
      repoName: 'existing',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', sourceDir), {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/reminder-batch/existing'],
    });

    await executeUpdate(sourceDir);

    expect(console.log).toHaveBeenCalledWith(
      "Note: projects following this bundle's group may need `skillsmgr deploy --refresh` to pick up changes.",
    );

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('lists affected projects from global registry when bundle changes', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-update-affected-${Date.now()}`, 'reg-batch');
    mkdirSync(join(sourceDir, 'existing'), { recursive: true });
    mkdirSync(join(sourceDir, 'new-one'), { recursive: true });
    writeFileSync(join(sourceDir, 'existing', 'SKILL.md'), '---\nname: existing\n---\n');
    writeFileSync(join(sourceDir, 'new-one', 'SKILL.md'), '---\nname: new-one\n---\n');

    mkdirSync(join(testManagerDir, 'custom', 'reg-batch', 'existing'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'custom', 'reg-batch', 'existing', 'SKILL.md'),
      '---\nname: existing\n---\n',
    );

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/reg-batch/existing', {
      url: sourceDir,
      type: 'custom',
      repoName: 'existing',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', sourceDir), {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/reg-batch/existing'],
    });

    const projectA = join(tmpdir(), `skillsmgr-affected-a-${Date.now()}`);
    const projectB = join(tmpdir(), `skillsmgr-affected-b-${Date.now()}`);
    mkdirSync(projectA, { recursive: true });
    mkdirSync(projectB, { recursive: true });
    writeFileSync(
      join(testManagerDir, 'deployments.json'),
      JSON.stringify({
        version: '1.0',
        deployments: {
          [projectA]: {
            mode: 'link',
            followGroups: ['reg-batch'],
            pinnedSkills: [],
            lastDeployedAt: '',
          },
          [projectB]: {
            mode: 'link',
            followGroups: [],
            pinnedSkills: ['custom/reg-batch/existing'],
            lastDeployedAt: '',
          },
          '/missing-proj': {
            mode: 'link',
            followGroups: ['reg-batch'],
            pinnedSkills: [],
            lastDeployedAt: '',
          },
        },
      }),
    );

    await executeUpdate(sourceDir);

    const calls = vi.mocked(console.log).mock.calls.map((args) => String(args[0]));
    expect(calls.some((line) => line.includes("Projects using this bundle's group"))).toBe(true);
    expect(calls.some((line) => line.includes(projectA))).toBe(true);
    expect(calls.some((line) => line.includes(projectB))).toBe(true);
    expect(calls.some((line) => line.includes('/missing-proj'))).toBe(true);
    expect(calls.some((line) => line.includes('path missing'))).toBe(true);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
  });

  it('does not print refresh reminder when bundle is fully up to date', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-update-noreminder-${Date.now()}`, 'noreminder-batch');
    mkdirSync(join(sourceDir, 'existing'), { recursive: true });
    writeFileSync(join(sourceDir, 'existing', 'SKILL.md'), '---\nname: existing\n---\n');

    mkdirSync(join(testManagerDir, 'custom', 'noreminder-batch', 'existing'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'custom', 'noreminder-batch', 'existing', 'SKILL.md'),
      '---\nname: existing\n---\n',
    );

    const sourcesService = new SourcesService();
    sourcesService.addSource('custom/noreminder-batch/existing', {
      url: sourceDir,
      type: 'custom',
      repoName: 'existing',
      installMethod: 'local-copy',
    });
    sourcesService.addBundle(makeBundleId('local-batch', sourceDir), {
      type: 'local-batch',
      url: sourceDir,
      selectionMode: 'all',
      members: ['custom/noreminder-batch/existing'],
    });

    await executeUpdate(sourceDir);

    const reminderCalled = vi
      .mocked(console.log)
      .mock.calls.some(
        (args) => typeof args[0] === 'string' && args[0].includes('deploy --refresh'),
      );
    expect(reminderCalled).toBe(false);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });
});

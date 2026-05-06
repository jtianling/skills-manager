import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
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
  }

  return { GitHubService };
});

interface MockCloneState {
  skillsByUrl: Map<string, string[]>;
  defaultSkills: string[];
  lastClonedSkills: string[];
}

const mockCloneState: MockCloneState = {
  skillsByUrl: new Map(),
  defaultSkills: ['grouped-skill'],
  lastClonedSkills: [],
};

vi.mock('../services/repo-clone.js', async () => {
  const { mkdirSync, writeFileSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  return {
    async cloneRepoToTemp(source: string) {
      const tempDir = join(tmpdir(), `skillsmgr-test-clone-${Date.now()}-${Math.random()}`);
      const repoPath = join(tempDir, 'repo');
      const skills = mockCloneState.skillsByUrl.get(source) ?? mockCloneState.defaultSkills;
      mockCloneState.lastClonedSkills = skills;
      for (const name of skills) {
        const skillDir = join(repoPath, 'skills', name);
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${name}\n---\n`);
      }
      return {
        repoPath,
        cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
      };
    },
    collectSkillsFromClone(repoPath: string) {
      return mockCloneState.lastClonedSkills.map((name) => ({
        name,
        description: '',
        path: join(repoPath, 'skills', name),
      }));
    },
  };
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
import { GroupsService } from '../services/groups.js';
import { SourcesService } from '../services/sources.js';
import { makeBundleId } from '../utils/url-normalize.js';
import { promptConfirm } from '../utils/prompts.js';
import { executeUpdate, executeUpdateWithOptions } from './update.js';

describe('update command', () => {
  let testManagerDir: string;

  function createPhysicalGroup(name: string, sourceDir: string): void {
    new GroupsService().createLocalBatchGroup(name, sourceDir);
  }

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-update-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(promptConfirm).mockResolvedValue(true);

    mockCloneState.skillsByUrl = new Map();
    mockCloneState.defaultSkills = ['grouped-skill'];
    mockCloneState.lastClonedSkills = [];
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readSources() {
    const path = join(testManagerDir, 'sources.json');
    if (!existsSync(path)) {
      return { version: '3.0', sources: {}, bundles: {} };
    }

    return JSON.parse(readFileSync(path, 'utf-8'));
  }

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

  it('updates a local skill by explicit path when original path has changes', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-${Date.now()}`, 'my-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('Updating custom/my-skill...\n');
    expect(console.log).toHaveBeenCalledWith('  ↑ my-skill: updated');
    const updated = readFileSync(join(installedDir, 'SKILL.md'), 'utf-8');
    expect(updated).toBe('new content');

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('reports up to date for a local skill updated by explicit path', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-${Date.now()}`, 'my-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'same content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'same content');

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ✓ my-skill: up to date');

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('reports directory not found when explicit local update path does not exist', async () => {
    await executeUpdate('/nonexistent/path/gone-skill');

    expect(console.log).toHaveBeenCalledWith('Directory not found: /nonexistent/path/gone-skill');
  });

  it('updates an orphan local skill without creating sources.json entry', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-original-path-${Date.now()}`, 'path-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'updated content');

    const installedDir = join(testManagerDir, 'custom', 'path-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith('  ↑ path-skill: updated');
    expect(readSources().sources['custom/path-skill']).toBeUndefined();

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('rebinds a moved physical group after confirmation and continues update', async () => {
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
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldBatchDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    createPhysicalGroup('tdd-spec', oldBatchDir);

    await executeUpdateWithOptions(newBatchDir);

    expect(promptConfirm).toHaveBeenCalledWith(
      expect.stringContaining(`Old path: ${oldBatchDir}`),
      false,
    );
    expect(console.log).toHaveBeenCalledWith('  + skill-b: installed');
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    const groupsData = JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
    expect(groupsData.groups['tdd-spec']).toMatchObject({
      kind: 'local-batch',
      url: newBatchDir,
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
    sourcesService.addSource('custom/tdd-spec/skill-a', {
      url: oldBatchDir,
      type: 'custom',
      repoName: 'skill-a',
      installMethod: 'local-copy',
    });
    createPhysicalGroup('tdd-spec', oldBatchDir);

    await executeUpdateWithOptions(newBatchDir);

    expect(console.log).toHaveBeenCalledWith('Cancelled.');
    const sourcesData = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    const groupsData = JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
    expect(groupsData.groups['tdd-spec']).toMatchObject({ url: oldBatchDir });
    expect(sourcesData.sources['custom/tdd-spec/skill-a'].url).toBe(oldBatchDir);

    rmSync(join(newBatchDir, '..'), { recursive: true, force: true });
  });

  it('does not prompt when updating a local skill with --force', async () => {
    const newDir = join(tmpdir(), `skillsmgr-new-force-${Date.now()}`, 'my-skill');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, 'SKILL.md'), 'new content');

    const installedDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(join(installedDir, 'SKILL.md'), 'old content');

    await executeUpdateWithOptions(newDir, { force: true });

    expect(promptConfirm).not.toHaveBeenCalled();
    expect(readSources().sources['custom/my-skill']).toBeUndefined();
    expect(readFileSync(join(installedDir, 'SKILL.md'), 'utf-8')).toBe('new content');

    rmSync(join(newDir, '..'), { recursive: true, force: true });
  });

  it('reports not found when source path does not exist', async () => {
    await executeUpdate('/nonexistent/path/some-skill');

    expect(console.log).toHaveBeenCalledWith('Directory not found: /nonexistent/path/some-skill');
  });

  it('reports not found when skill is not installed', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-notinstalled-${Date.now()}`, 'unknown-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(join(originalDir, 'SKILL.md'), 'content');

    await executeUpdate(originalDir);

    expect(console.log).toHaveBeenCalledWith(
      `Skill 'unknown-skill' is not installed. Run: skillsmgr install ${originalDir}`
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
    createPhysicalGroup('tdd-spec', oldDir);

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      'Hint: The old path still exists. Remove or rename the old directory before running update again.',
    );
    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${newDir}. ` +
      `A group with the same name is installed from ${oldDir} ` +
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
    createPhysicalGroup('tdd-spec', oldDir);

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      `Path type mismatch: existing group 'tdd-spec' is batch, ` +
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
    createPhysicalGroup('legacy-a', oldDirA);
    createPhysicalGroup('legacy-b', oldDirB);

    await executeUpdate(newDir);

    expect(console.log).toHaveBeenCalledWith(
      `No installed skill found from path: ${newDir}. ` +
      "Multiple installed local sources share basename 'tdd-spec':\n" +
      `  - legacy-a: ${oldDirA}\n` +
      `  - legacy-b: ${oldDirB}`,
    );

    rmSync(join(newDir, '..'), { recursive: true, force: true });
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

    mockCloneState.skillsByUrl.set('https://github.com/anthropics/skills', ['commit']);

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

  it('syncs local physical group when updating by batch path', async () => {
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
    createPhysicalGroup('spec-tdd', batchDir);

    await executeUpdateWithOptions(batchDir);

    expect(console.log).toHaveBeenCalledWith('Updating spec-tdd...\n');
    expect(console.log).toHaveBeenCalledWith('  + skill-b: installed');
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

    await executeUpdate(batchDir);
    expect(console.log).toHaveBeenCalledWith(`No installed skill found from path: ${batchDir}`);

    rmSync(join(batchDir, '..'), { recursive: true, force: true });
  });

  it('prints refresh reminder when physical group has new skills', async () => {
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
    createPhysicalGroup('reminder-batch', sourceDir);

    await executeUpdate(sourceDir);

    expect(console.log).toHaveBeenCalledWith(
      'Note: projects following this physical group may need `skillsmgr deploy --refresh` to pick up changes.',
    );

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('lists affected projects from global registry when physical group changes', async () => {
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
    createPhysicalGroup('reg-batch', sourceDir);

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

  it('does not print refresh reminder when physical group is fully up to date', async () => {
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
    createPhysicalGroup('noreminder-batch', sourceDir);

    await executeUpdate(sourceDir);

    const reminderCalled = vi
      .mocked(console.log)
      .mock.calls.some(
        (args) => typeof args[0] === 'string' && args[0].includes('deploy --refresh'),
      );
    expect(reminderCalled).toBe(false);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('skips standalone local skills during bare update and prints a hint', async () => {
    const localDir = join(testManagerDir, 'custom', 'skip-me');
    mkdirSync(localDir, { recursive: true });
    writeFileSync(join(localDir, 'SKILL.md'), '---\nname: skip-me\n---\n');

    await executeUpdate();

    expect(console.log).toHaveBeenCalledWith('Updating all installed sources...\n');
    expect(console.log).toHaveBeenCalledWith('Done! 0 updated, 0 up to date, 0 failed, 0 skipped');
    expect(console.log).toHaveBeenCalledWith(
      '1 local skill(s) skipped. Use `skillsmgr update ./path` to update a local skill.',
    );
  });
});

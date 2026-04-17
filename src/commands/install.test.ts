import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToInstall: vi.fn().mockResolvedValue({ names: [], isAll: false }),
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { GroupsService } from '../services/groups.js';
import { SourcesService } from '../services/sources.js';
import { executeInstall } from './install.js';
import { promptConfirm, promptSkillsToInstall } from '../utils/prompts.js';

describe('install command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-install-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-install-proj-${id}`);

    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(testProjectDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(promptConfirm).mockResolvedValue(true);
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
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

  function readGroups() {
    return JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
  }

  it('rejects bare words with unknown source format', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeInstall('local-skill', {})).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith(
      'Error: Unknown source format "local-skill". Use ./name for local, owner/repo for GitHub.',
    );
    mockExit.mockRestore();
  });

  it('installs a local directory with explicit ./ prefix', async () => {
    const skillDir = join(testProjectDir, 'local-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: local-skill\ndescription: Local skill\n---\n');

    await executeInstall('./local-skill', {});

    const targetDir = join(testManagerDir, 'custom', 'local-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.sources['custom/local-skill']).toBeUndefined();
    expect(sources.bundles).toEqual({});
  });

  it('installs a local skill and adds it to virtual group', async () => {
    const skillDir = join(testProjectDir, 'grouped-local-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: grouped-local-skill\ndescription: Grouped local skill\n---\n');

    await executeInstall('./grouped-local-skill', { group: 'my-tools' });

    // Installed flat (no group subdirectory)
    const targetDir = join(testManagerDir, 'custom', 'grouped-local-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.sources['custom/grouped-local-skill']).toBeUndefined();

    // Added to virtual group
    const groups = readGroups();
    expect(groups.groups['my-tools']).toEqual({
      kind: 'virtual',
      members: ['custom/grouped-local-skill'],
    });
  });

  it.each(['.zip', '.skill'])(
    'installs a local %s archive with the same target path and source metadata',
    async (extension) => {
      const skillDir = join(testProjectDir, 'zip-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: zip-skill\ndescription: Zip skill\n---\n');

      const archivePath = join(testProjectDir, `zip-skill${extension}`);
      execFileSync('zip', ['-qr', archivePath, 'zip-skill'], { cwd: testProjectDir });

      await executeInstall(archivePath, {});

      const targetDir = join(testManagerDir, 'custom', 'zip-skill');
      expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

      const sources = readSources();
      expect(sources.sources['custom/zip-skill']).toMatchObject({
        url: archivePath,
        type: 'custom',
        repoName: 'zip-skill',
        installMethod: 'zip',
      });
      expect(sources.bundles[`zip:${archivePath}`]).toMatchObject({
        type: 'zip',
        url: archivePath,
        selectionMode: 'all',
        members: ['custom/zip-skill'],
      });
    }
  );

  it('installs a remote zip file and records the original URL', async () => {
    const skillDir = join(testProjectDir, 'remote-zip-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: remote-zip-skill\ndescription: Remote zip skill\n---\n');

    const zipPath = join(testProjectDir, 'remote-zip-skill.zip');
    execFileSync('zip', ['-qr', zipPath, 'remote-zip-skill'], { cwd: testProjectDir });
    const zipBuffer = readFileSync(zipPath);

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input === 'https://example.com/skills.zip') {
        return {
          ok: true,
          arrayBuffer: async () => zipBuffer.buffer.slice(
            zipBuffer.byteOffset,
            zipBuffer.byteOffset + zipBuffer.byteLength,
          ),
        };
      }

      throw new Error(`Unexpected fetch: ${input}`);
    }));

    await executeInstall('https://example.com/skills.zip', {});

    const targetDir = join(testManagerDir, 'custom', 'remote-zip-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.sources['custom/remote-zip-skill']).toMatchObject({
      url: 'https://example.com/skills.zip',
      installMethod: 'zip',
    });
    expect(sources.bundles['zip:https://example.com/skills.zip']).toMatchObject({
      type: 'zip',
      url: 'https://example.com/skills.zip',
      selectionMode: 'all',
      members: ['custom/remote-zip-skill'],
    });
  });

  it('overwrites existing same-name custom skill with --force', async () => {
    const existingDir = join(testManagerDir, 'custom', 'overwrite-skill');
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, 'SKILL.md'), '---\nname: overwrite-skill\n---\nold');

    const skillDir = join(testProjectDir, 'overwrite-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: overwrite-skill\n---\nnew');

    await executeInstall('./overwrite-skill', { force: true });

    const content = readFileSync(join(existingDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('new');
  });

  it('prompts overwrite when reinstalling the same local path', async () => {
    const skillDir = join(testProjectDir, 'overwrite-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: overwrite-skill\n---\nnew');

    const existingDir = join(testManagerDir, 'custom', 'overwrite-skill');
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, 'SKILL.md'), '---\nname: overwrite-skill\n---\nold');

    await executeInstall('./overwrite-skill', {});

    expect(readFileSync(join(existingDir, 'SKILL.md'), 'utf-8')).toContain('new');
  });

  it('overwrites an existing same-name local skill from a different path', async () => {
    const newDir = join(testProjectDir, 'abc');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, 'SKILL.md'), '---\nname: abc\n---\nnew');

    const existingDir = join(testManagerDir, 'custom', 'abc');
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, 'SKILL.md'), 'old');

    await executeInstall('./abc', {});

    expect(readFileSync(join(existingDir, 'SKILL.md'), 'utf-8')).toContain('new');
  });

  it('overwrites a same-name batch member when installing a single local skill', async () => {
    const batchDir = join(tmpdir(), `skillsmgr-batch-member-${Date.now()}`, 'tdd-spec');
    const singleDir = join(testProjectDir, 'child-a');
    mkdirSync(batchDir, { recursive: true });
    mkdirSync(singleDir, { recursive: true });
    writeFileSync(join(singleDir, 'SKILL.md'), '---\nname: child-a\n---\nsingle');

    const existingBatchMemberDir = join(testManagerDir, 'custom', 'tdd-spec', 'child-a');
    mkdirSync(existingBatchMemberDir, { recursive: true });
    writeFileSync(join(existingBatchMemberDir, 'SKILL.md'), '---\nname: child-a\n---\nbatch');

    const sourcesService = new SourcesService();
    const groupsService = new GroupsService();
    sourcesService.addSource('custom/tdd-spec/child-a', {
      url: batchDir,
      type: 'custom',
      repoName: 'child-a',
      installMethod: 'local-copy',
    });
    groupsService.createLocalBatchGroup('tdd-spec', batchDir);

    await executeInstall('./child-a', {});

    expect(existsSync(join(testManagerDir, 'custom', 'child-a', 'SKILL.md'))).toBe(false);
    expect(readFileSync(join(existingBatchMemberDir, 'SKILL.md'), 'utf-8')).toContain('single');

    const sources = readSources();
    expect(sources.sources['custom/child-a']).toBeUndefined();
    expect(sources.sources['custom/tdd-spec/child-a']).toMatchObject({
      url: batchDir,
      type: 'custom',
      repoName: 'child-a',
      installMethod: 'local-copy',
    });

    rmSync(join(batchDir, '..'), { recursive: true, force: true });
  });

  it('overwrites a top-level skill from a different local path', async () => {
    const newDir = join(testProjectDir, 'child-a');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(newDir, 'SKILL.md'), '---\nname: child-a\n---\nnew');

    const existingDir = join(testManagerDir, 'custom', 'child-a');
    mkdirSync(existingDir, { recursive: true });
    writeFileSync(join(existingDir, 'SKILL.md'), 'installed');

    await executeInstall('./child-a', {});
    expect(readFileSync(join(existingDir, 'SKILL.md'), 'utf-8')).toContain('new');
  });

  describe('batch install from directory', () => {
    function createSkillDir(base: string, name: string): void {
      const dir = join(base, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\n`);
    }

    it('batch installs skills from directory without SKILL.md', async () => {
      const batchDir = join(testProjectDir, 'my-skills');
      createSkillDir(batchDir, 'skill-a');
      createSkillDir(batchDir, 'skill-b');

      await executeInstall('./my-skills', { all: true });

      expect(existsSync(join(testManagerDir, 'custom', 'my-skills', 'skill-a', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(testManagerDir, 'custom', 'my-skills', 'skill-b', 'SKILL.md'))).toBe(true);

      const sources = readSources();
      expect(sources.sources['custom/my-skills/skill-a']).toMatchObject({ type: 'custom', installMethod: 'local-copy' });
      expect(sources.sources['custom/my-skills/skill-b']).toMatchObject({ type: 'custom', installMethod: 'local-copy' });
      const groups = readGroups();
      expect(groups.groups['my-skills']).toMatchObject({
        kind: 'local-batch',
        url: batchDir,
      });
    });

    it('allows idempotent batch reinstall from the same path', async () => {
      const batchDir = join(testProjectDir, 'tdd-spec');
      createSkillDir(batchDir, 'skill-a');

      const sourcesService = new SourcesService();
      const groupsService = new GroupsService();
      sourcesService.addSource('custom/tdd-spec/skill-a', {
        url: batchDir,
        type: 'custom',
        repoName: 'skill-a',
        installMethod: 'local-copy',
      });
      groupsService.createLocalBatchGroup('tdd-spec', batchDir);

      await executeInstall('./tdd-spec', { all: true });

      const groups = readGroups();
      expect(groups.groups['tdd-spec']).toMatchObject({
        url: batchDir,
        kind: 'local-batch',
      });
    });

    it('rejects batch install when the same basename is already installed from another path', async () => {
      const oldDir = join(tmpdir(), `skillsmgr-batch-old-${Date.now()}`, 'tdd-spec');
      const newDir = join(testProjectDir, 'tdd-spec');
      createSkillDir(newDir, 'skill-a');

      const groupsService = new GroupsService();
      groupsService.createLocalBatchGroup('tdd-spec', oldDir);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeInstall('./tdd-spec', { all: true })).rejects.toThrow('process.exit');
      expect(console.error).toHaveBeenCalledWith(
        `Error: A local-batch group 'tdd-spec' is already installed from ${oldDir}. ` +
        `To move it to ${newDir}, run: skillsmgr update ${newDir}`,
      );
      mockExit.mockRestore();
    });

    it('rejects batch install when multiple dirty bundle candidates exist', async () => {
      const oldDirA = join(tmpdir(), `skillsmgr-batch-old-a-${Date.now()}`, 'tdd-spec');
      const oldDirB = join(tmpdir(), `skillsmgr-batch-old-b-${Date.now()}`, 'tdd-spec');
      const newDir = join(testProjectDir, 'tdd-spec');
      createSkillDir(newDir, 'skill-a');

      const groupsService = new GroupsService();
      groupsService.createLocalBatchGroup('legacy-a', oldDirA);
      groupsService.createLocalBatchGroup('legacy-b', oldDirB);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeInstall('./tdd-spec', { all: true })).rejects.toThrow('process.exit');
      expect(console.error).toHaveBeenCalledWith(
        "Error: Multiple local-batch groups named 'tdd-spec' are already installed:\n" +
        `  - legacy-a: ${oldDirA}\n` +
        `  - legacy-b: ${oldDirB}\n` +
        'Clean up the duplicate group entries and try again.',
      );
      mockExit.mockRestore();
    });

    it('allows a same-name single skill and batch bundle to coexist', async () => {
      const singleDir = join(testManagerDir, 'custom', 'tdd-spec');
      mkdirSync(singleDir, { recursive: true });
      writeFileSync(join(singleDir, 'SKILL.md'), '---\nname: tdd-spec\n---\n');

      const singleSourceDir = join(tmpdir(), `skillsmgr-single-source-${Date.now()}`, 'tdd-spec');
      mkdirSync(singleSourceDir, { recursive: true });
      writeFileSync(join(singleSourceDir, 'SKILL.md'), '---\nname: tdd-spec\n---\n');

      const batchDir = join(testProjectDir, 'tdd-spec');
      createSkillDir(batchDir, 'child-a');

      await executeInstall('./tdd-spec', { all: true });

      expect(existsSync(join(singleDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(join(testManagerDir, 'custom', 'tdd-spec', 'child-a', 'SKILL.md'))).toBe(true);
      rmSync(join(singleSourceDir, '..'), { recursive: true, force: true });
    });

    it('auto-creates group with directory name after batch install', async () => {
      const batchDir = join(testProjectDir, 'openspec');
      createSkillDir(batchDir, 'explore');
      createSkillDir(batchDir, 'ff-change');

      await executeInstall('./openspec', { all: true });

      const groups = readGroups();
      expect(groups.groups['openspec']).toMatchObject({
        kind: 'local-batch',
        url: batchDir,
      });
    });

    it('--group creates an extra virtual group alongside the physical group', async () => {
      const batchDir = join(testProjectDir, 'openspec');
      createSkillDir(batchDir, 'explore');

      await executeInstall('./openspec', { all: true, group: 'tools' });

      const groups = readGroups();
      expect(groups.groups['openspec']).toMatchObject({
        kind: 'local-batch',
        url: batchDir,
      });
      expect(groups.groups['tools']).toEqual({
        kind: 'virtual',
        members: ['custom/openspec/explore'],
      });
    });

    it('--skill filters specific skills in batch install', async () => {
      const batchDir = join(testProjectDir, 'my-skills');
      createSkillDir(batchDir, 'skill-a');
      createSkillDir(batchDir, 'skill-b');
      createSkillDir(batchDir, 'skill-c');

      await executeInstall('./my-skills', { skill: ['skill-a', 'skill-c'] });

      expect(existsSync(join(testManagerDir, 'custom', 'my-skills', 'skill-a', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(testManagerDir, 'custom', 'my-skills', 'skill-c', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(testManagerDir, 'custom', 'my-skills', 'skill-b', 'SKILL.md'))).toBe(false);

      const groups = readGroups();
      expect(groups.groups['my-skills']).toMatchObject({
        kind: 'local-batch',
        url: batchDir,
      });
    });

    it('uses interactive isAll=false for subset batch bundles', async () => {
      const batchDir = join(testProjectDir, 'my-skills');
      createSkillDir(batchDir, 'skill-a');
      createSkillDir(batchDir, 'skill-b');

      vi.mocked(promptSkillsToInstall).mockResolvedValueOnce({
        names: ['skill-b'],
        isAll: false,
      });

      await executeInstall('./my-skills', {});

      const groups = readGroups();
      expect(groups.groups['my-skills']).toMatchObject({
        kind: 'local-batch',
        url: batchDir,
      });
    });

    it('errors when directory has no skills', async () => {
      const emptyDir = join(testProjectDir, 'empty-dir');
      mkdirSync(emptyDir, { recursive: true });

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeInstall('./empty-dir', { all: true })).rejects.toThrow('process.exit');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No skills found'));
      mockExit.mockRestore();
    });
  });
});

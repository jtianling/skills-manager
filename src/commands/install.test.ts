import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToInstall: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { executeInstall } from './install.js';

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
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readSources() {
    return JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
  }

  it('rejects bare words with unknown source format error', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeInstall('local-skill', {})).rejects.toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown source format'),
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
    expect(sources.sources['custom/local-skill']).toMatchObject({
      url: skillDir,
      type: 'custom',
      repoName: 'local-skill',
      installMethod: 'local-copy',
    });
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
    expect(sources.sources['custom/grouped-local-skill']).toMatchObject({
      url: skillDir,
      type: 'custom',
      repoName: 'grouped-local-skill',
      installMethod: 'local-copy',
    });

    // Added to virtual group
    const groups = JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
    expect(groups['my-tools']).toContain('custom/grouped-local-skill');
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
      expect(sources.sources['custom/skill-a']).toMatchObject({ type: 'custom', installMethod: 'local-copy' });
      expect(sources.sources['custom/skill-b']).toMatchObject({ type: 'custom', installMethod: 'local-copy' });
    });

    it('auto-creates group with directory name after batch install', async () => {
      const batchDir = join(testProjectDir, 'openspec');
      createSkillDir(batchDir, 'explore');
      createSkillDir(batchDir, 'ff-change');

      await executeInstall('./openspec', { all: true });

      const groups = JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
      expect(groups['openspec']).toContain('custom/explore');
      expect(groups['openspec']).toContain('custom/ff-change');
    });

    it('--group overrides auto group name', async () => {
      const batchDir = join(testProjectDir, 'openspec');
      createSkillDir(batchDir, 'explore');

      await executeInstall('./openspec', { all: true, group: 'tools' });

      const groups = JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
      expect(groups['tools']).toContain('custom/explore');
      expect(groups['openspec']).toBeUndefined();
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

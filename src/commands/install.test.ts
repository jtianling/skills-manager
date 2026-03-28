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

vi.mock('../services/github.js', async () => {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');

  class GitHubService {
    parseGitHubUrl(url: string) {
      const treeMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?/);
      if (treeMatch) {
        return {
          owner: treeMatch[1],
          repo: treeMatch[2],
          branch: treeMatch[3],
          path: treeMatch[4],
        };
      }

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
      return [{ name: 'remote-skill', path: 'skills/remote-skill' }];
    }

    async fetchRootFile() {
      return null;
    }

    async downloadSkill(_owner: string, _repo: string, _path: string, targetDir: string) {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, 'SKILL.md'), '---\nname: remote-skill\ndescription: Remote skill\n---\n');
    }

    async downloadRepoRoot(_owner: string, _repo: string, targetDir: string) {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(join(targetDir, 'SKILL.md'), '---\nname: remote-root\ndescription: Remote root skill\n---\n');
    }
  }

  return { GitHubService };
});

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
});

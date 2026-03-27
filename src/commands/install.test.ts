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
import { executeInstall, installSource } from './install.js';
import { installViaGitClone } from './install-git.js';

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

  it('installs a local directory into a custom group', async () => {
    const skillDir = join(testProjectDir, 'grouped-local-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: grouped-local-skill\ndescription: Grouped local skill\n---\n');

    await executeInstall('./grouped-local-skill', { group: 'my-tools' });

    const targetDir = join(testManagerDir, 'custom', 'my-tools', 'grouped-local-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.sources['custom/my-tools/grouped-local-skill']).toMatchObject({
      url: skillDir,
      type: 'custom',
      repoName: 'grouped-local-skill',
      installMethod: 'local-copy',
    });
  });

  it('installs a local zip file and records zip metadata', async () => {
    const skillDir = join(testProjectDir, 'zip-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: zip-skill\ndescription: Zip skill\n---\n');

    const zipPath = join(testProjectDir, 'zip-skill.zip');
    execFileSync('zip', ['-qr', zipPath, 'zip-skill'], { cwd: testProjectDir });

    await executeInstall(zipPath, {});

    const targetDir = join(testManagerDir, 'custom', 'zip-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.sources['custom/zip-skill']).toMatchObject({
      url: zipPath,
      type: 'custom',
      repoName: 'zip-skill',
      installMethod: 'zip',
    });
  });

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

  it('installs grouped remote skills under custom/<group>/<skill>', async () => {
    // Create a local git repo to serve as source
    const localRepoDir = join(tmpdir(), `skillsmgr-local-repo-${Date.now()}`);
    const skillDir = join(localRepoDir, 'skills', 'remote-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: remote-skill\ndescription: Remote skill\n---\n');
    execFileSync('git', ['init'], { cwd: localRepoDir, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: localRepoDir, stdio: 'pipe' });
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: localRepoDir, stdio: 'pipe' });

    try {
      const result = await installViaGitClone(localRepoDir, { all: true, group: 'my-tools' });

      const targetDir = join(testManagerDir, 'custom', 'my-tools', 'remote-skill');
      expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);
      expect(result.installedPaths).toEqual([targetDir]);
      expect(result.sourceKeys).toEqual(['custom/my-tools/remote-skill']);
    } finally {
      rmSync(localRepoDir, { recursive: true, force: true });
    }
  });
});

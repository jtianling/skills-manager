import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import { cloneRepoToTemp } from '../src/services/repo-clone.js';

const REPO = 'obra/superpowers';
const REPO_URL = `https://github.com/${REPO}`;
const CLI = join(import.meta.dirname, '..', 'dist', 'index.js');

function listFilesRecursive(root: string): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        out.set(relative(root, full), st.size);
      }
    }
  };
  walk(root);
  return out;
}

describe('codeload install E2E', () => {
  let cleanups: Array<() => void>;

  beforeEach(() => {
    cleanups = [];
  });

  afterEach(() => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // best effort
      }
    }
  });

  // 7.3 + 7.6: real public repo install via codeload, version === commit sha.
  it('installs a public repo via codeload and records the commit sha', () => {
    const home = mkdtempSync(join(tmpdir(), 'smgr-cl-home-'));
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));

    execFileSync('node', [CLI, 'install', REPO, '--all'], {
      env: { ...process.env, HOME: home },
      stdio: 'pipe',
    });

    const sourcesPath = join(home, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
    const key = Object.keys(sources.sources).find((k) => k.includes('superpowers'));
    expect(key).toBeDefined();
    const version = sources.sources[key!].version as string | undefined;
    expect(version).toMatch(/^[0-9a-f]{40}$/);

    const installDir = join(home, '.skills-manager', key!);
    expect(existsSync(installDir)).toBe(true);
    expect(readdirSync(installDir).length).toBeGreaterThan(0);
  }, 120_000);

  // 7.4: codeload file tree matches `git clone --depth 1` (excluding .git).
  it('codeload file tree matches git clone --depth 1', async () => {
    const cloned = await cloneRepoToTemp(REPO);
    cleanups.push(() => cloned.cleanup());
    expect(cloned.commitSha).toMatch(/^[0-9a-f]{40}$/);

    const gitDir = mkdtempSync(join(tmpdir(), 'smgr-cl-git-'));
    cleanups.push(() => rmSync(gitDir, { recursive: true, force: true }));
    execFileSync(
      'git',
      ['clone', '--quiet', '--depth', '1', REPO_URL, join(gitDir, 'repo')],
      { stdio: 'pipe' },
    );

    const codeloadFiles = listFilesRecursive(cloned.repoPath);
    const gitFiles = listFilesRecursive(join(gitDir, 'repo'));

    // Same set of relative paths (deterministic on a single HEAD).
    expect([...codeloadFiles.keys()].sort()).toEqual([...gitFiles.keys()].sort());

    // Byte-identical content for a deeply-nested sample file.
    const sample = [...gitFiles.keys()].find((p) => p.includes('/'));
    expect(sample).toBeDefined();
    expect(readFileSync(join(cloned.repoPath, sample!))).toEqual(
      readFileSync(join(gitDir, 'repo', sample!)),
    );
  }, 120_000);

  // 7.5a: install succeeds with git removed from PATH (codeload path).
  it('installs a public repo with no git on PATH', () => {
    const home = mkdtempSync(join(tmpdir(), 'smgr-cl-nogit-'));
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));
    const emptyBin = mkdtempSync(join(tmpdir(), 'smgr-cl-bin-'));
    cleanups.push(() => rmSync(emptyBin, { recursive: true, force: true }));

    // PATH limited to node's own dir + an empty bin, so no `git` is resolvable.
    const nodeDir = process.execPath.replace(/\/node$/, '');
    execFileSync('node', [CLI, 'install', REPO, '--all'], {
      env: { ...process.env, HOME: home, PATH: `${emptyBin}:${nodeDir}` },
      stdio: 'pipe',
    });

    const sourcesPath = join(home, '.skills-manager', 'sources.json');
    expect(existsSync(sourcesPath)).toBe(true);
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
    const key = Object.keys(sources.sources).find((k) => k.includes('superpowers'));
    expect(key).toBeDefined();
    expect(sources.sources[key!].version).toMatch(/^[0-9a-f]{40}$/);
  }, 120_000);

  // 7.5b: private/inaccessible repo with no git → friendly error, not ENOENT.
  it('emits a friendly error for an inaccessible repo with no git on PATH', () => {
    const home = mkdtempSync(join(tmpdir(), 'smgr-cl-priv-'));
    cleanups.push(() => rmSync(home, { recursive: true, force: true }));
    const emptyBin = mkdtempSync(join(tmpdir(), 'smgr-cl-pbin-'));
    cleanups.push(() => rmSync(emptyBin, { recursive: true, force: true }));
    const nodeDir = process.execPath.replace(/\/node$/, '');

    let stderr = '';
    let failed = false;
    try {
      execFileSync(
        'node',
        [CLI, 'install', 'skillsmgr-nonexistent-owner/private-xyz-404', '--all'],
        {
          env: {
            ...process.env,
            HOME: home,
            PATH: `${emptyBin}:${nodeDir}`,
            // Strip any token so the repo reads as inaccessible.
            GITHUB_TOKEN: '',
          },
          stdio: 'pipe',
        },
      );
    } catch (error) {
      failed = true;
      stderr = `${(error as { stderr?: Buffer }).stderr ?? ''}` +
        `${(error as { stdout?: Buffer }).stdout ?? ''}`;
    }

    expect(failed).toBe(true);
    expect(stderr).toMatch(/requires git/i);
    expect(stderr).not.toMatch(/ENOENT/);
  }, 120_000);
});

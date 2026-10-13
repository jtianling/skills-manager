import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use local git remotes and an isolated HOME: no GitHub access or tmux needed.
describe('all-source bundle reconciliation CLI', () => {
  let root: string;
  let home: string;
  let manager: string;
  let remote: string;
  const sourceKey = 'community/example/skills';

  function skill(base: string, name: string, body: string): void {
    mkdirSync(join(base, name), { recursive: true });
    writeFileSync(join(base, name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill\n---\n${body}\n`);
  }

  function git(...args: string[]): void {
    execFileSync('git', args, { cwd: remote, stdio: 'pipe' });
  }

  function run(...args: string[]): string {
    return execFileSync(process.execPath,
      [join(import.meta.dirname, '../dist/index.js'), ...args], {
        env: { ...process.env, HOME: home }, encoding: 'utf8',
      });
  }

  function seed(selectionMode: 'all' | 'subset'): void {
    const now = new Date().toISOString();
    writeFileSync(join(manager, 'sources.json'), JSON.stringify({
      version: '3.0',
      sources: {
        [sourceKey]: {
          url: remote, type: 'community', repoName: 'skills',
          installMethod: 'git', installedAt: now, updatedAt: now,
        },
      },
      bundles: {
        [`git:${remote}`]: {
          type: 'git', url: remote, selectionMode, members: [sourceKey],
          installedAt: now, updatedAt: now,
        },
      },
    }));
    skill(join(manager, sourceKey), 'existing', 'old content');
    skill(join(manager, sourceKey), 'gone', 'removed remote skill');
    skill(join(manager, 'custom'), 'standalone', 'user content');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skillsmgr-bundle-cli-'));
    home = join(root, 'home');
    manager = join(home, '.skills-manager');
    remote = join(root, 'remote');
    mkdirSync(manager, { recursive: true });
    mkdirSync(remote, { recursive: true });
    git('init', '-q');
    skill(join(remote, 'skills'), 'existing', 'updated content');
    skill(join(remote, 'skills'), 'new', 'new remote skill');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com',
      'commit', '-qm', 'fixture');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('adds full-repo skills safely, then prunes only with --sync', () => {
    seed('all');

    const safeOutput = run('update');

    expect(safeOutput).toContain('1 updated, 1 added, 1 removed (kept)');
    expect(readFileSync(join(manager, sourceKey, 'existing/SKILL.md'), 'utf8'))
      .toContain('updated content');
    expect(existsSync(join(manager, sourceKey, 'new/SKILL.md'))).toBe(true);
    expect(existsSync(join(manager, sourceKey, 'gone/SKILL.md'))).toBe(true);

    const syncOutput = run('update', '--sync', '--verbose');

    expect(syncOutput).toContain('1 removed, 2 up to date');
    expect(existsSync(join(manager, sourceKey, 'gone'))).toBe(false);
    expect(existsSync(join(manager, sourceKey, 'existing/SKILL.md'))).toBe(true);
    expect(readFileSync(join(manager, 'custom/standalone/SKILL.md'), 'utf8'))
      .toContain('user content');
  });

  it('prunes a subset without installing unselected remote skills', () => {
    seed('subset');

    const output = run('update', '--sync');

    expect(output).toContain('0 added, 0 removed (kept), 1 removed');
    expect(output).toContain('1 skipped');
    expect(existsSync(join(manager, sourceKey, 'new'))).toBe(false);
    expect(existsSync(join(manager, sourceKey, 'gone'))).toBe(false);
    expect(readFileSync(join(manager, sourceKey, 'existing/SKILL.md'), 'utf8'))
      .toContain('updated content');
    expect(readFileSync(join(manager, 'custom/standalone/SKILL.md'), 'utf8'))
      .toContain('user content');
  });
});

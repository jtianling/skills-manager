import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const cli = resolve('dist/index.js');

describe('positional group add/remove CLI', () => {
  let root: string;
  let homeDir: string;
  let projectDir: string;
  let managerDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skillsmgr-group-cli-'));
    homeDir = join(root, 'home');
    projectDir = join(root, 'project');
    managerDir = join(homeDir, '.skills-manager');
    mkdirSync(managerDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(...args: string[]): string {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: projectDir,
      env: { ...process.env, HOME: homeDir },
      encoding: 'utf8',
      timeout: 15_000,
    });
    if (result.error) throw result.error;
    expect(result.status, result.stdout + result.stderr).toBe(0);
    return result.stdout;
  }

  function createSkill(source: string, name: string): string {
    const path = join(managerDir, source, name);
    mkdirSync(path, { recursive: true });
    writeFileSync(
      join(path, 'SKILL.md'),
      `---\nname: ${name}\ndescription: test\n---\n`,
    );
    return path;
  }

  it.each([
    { kind: 'virtual', copy: false, global: false },
    { kind: 'local-batch', copy: true, global: false },
    { kind: 'virtual', copy: false, global: true },
  ])('test_cli_$kind (copy=$copy, global=$global)', (mode) => {
    const source = mode.kind === 'local-batch' ? 'custom/develop' : 'custom';
    const installed = createSkill(source, 'target');
    createSkill('custom', 'unrelated');
    const group = mode.kind === 'local-batch'
      ? { kind: mode.kind, url: '/fixture/develop' }
      : { kind: mode.kind, members: [`${source}/target`] };
    writeFileSync(join(managerDir, 'groups.json'), JSON.stringify({
      version: '2.0', groups: { develop: group },
    }));
    const scope = mode.global ? ['-g', '-a', 'claude-code'] : [];
    const addFlags = mode.global ? scope : ['-a', 'codex'];
    const copyFlags = mode.copy ? ['--copy'] : [];
    const deployedDir = mode.global
      ? join(homeDir, '.claude', 'skills')
      : join(projectDir, '.agents', 'skills');

    run('add', 'unrelated', ...addFlags, ...copyFlags);
    run('add', 'develop', ...addFlags, ...copyFlags);
    expect(readdirSync(deployedDir).sort()).toEqual(['target', 'unrelated']);
    const groupsBefore = readFileSync(join(managerDir, 'groups.json'), 'utf8');
    run('remove', 'develop', ...scope);

    expect(readdirSync(deployedDir)).toEqual(['unrelated']);
    expect(existsSync(join(installed, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(deployedDir, 'unrelated', 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(managerDir, 'groups.json'), 'utf8'))
      .toBe(groupsBefore);
    run('add', 'develop', ...addFlags, ...copyFlags);
    expect(readdirSync(deployedDir).sort()).toEqual(['target', 'unrelated']);
  });
});

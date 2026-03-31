import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('group rename E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function readGroups(): Record<string, string[]> {
    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(groupsPath)) return {};
    return JSON.parse(readFileSync(groupsPath, 'utf-8'));
  }

  function createLocalSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  it('renames group successfully and preserves skills', async () => {
    // WHEN: create group with a skill, then rename
    createLocalSkill('my-linter');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-linter', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add python my-linter');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group rename python py-tools');
    const output = await tmux.waitForText(/Renamed/, 10_000);

    // THEN: output confirms rename
    expect(output).toContain("Renamed group 'python' to 'py-tools'");

    // THEN: groups.json reflects the rename, skills preserved
    const groups = readGroups();
    expect(groups['python']).toBeUndefined();
    expect(groups['py-tools']).toContain('custom/my-linter');
  });

  it('errors when old group does not exist', async () => {
    // WHEN: rename nonexistent group
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group rename nonexistent new-name');
    const output = await tmux.waitForText(/not found/, 10_000);

    // THEN: error message
    expect(output).toContain("Group 'nonexistent' not found");
  });

  it('errors when new name already exists', async () => {
    // WHEN: create two groups, rename one to the other's name
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create python');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create rust');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group rename python rust');
    const output = await tmux.waitForText(/already exists/, 10_000);

    // THEN: error message, both groups unchanged
    expect(output).toContain("Group 'rust' already exists");
    const groups = readGroups();
    expect(groups['python']).toBeDefined();
    expect(groups['rust']).toBeDefined();
  });

  it('errors when new name has invalid format', async () => {
    // WHEN: rename with invalid new name containing spaces
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create valid');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group rename valid "my tools"');
    const output = await tmux.waitForText(/must contain only/, 10_000);

    // THEN: validation error
    expect(output).toContain('must contain only');
  });

  it('does not affect other groups when renaming', async () => {
    // WHEN: rename one group while another exists with skills
    createLocalSkill('tool-a');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./tool-a', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add alpha tool-a');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create beta');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group rename beta gamma');
    await tmux.waitForText(/Renamed/, 10_000);

    // THEN: alpha group is untouched
    const groups = readGroups();
    expect(groups['alpha']).toContain('custom/tool-a');
    expect(groups['beta']).toBeUndefined();
    expect(groups['gamma']).toBeDefined();
  });
});

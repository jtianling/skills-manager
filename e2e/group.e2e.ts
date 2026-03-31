import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('group E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function setup(): Promise<void> {
  }

  function createLocalSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  function readGroups(): Record<string, string[]> {
    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(groupsPath)) return {};
    return JSON.parse(readFileSync(groupsPath, 'utf-8'));
  }

  it('group list shows no groups initially', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group list');
    const output = await tmux.waitForText(/No groups defined/, 10_000);
    expect(output).toContain('No groups defined');
  });

  it('group create and list round-trip', async () => {
    await setup();

    // Create two groups
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create my-tools');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create python');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    // List should show both
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group list');
    const output = await tmux.waitForText(/my-tools/, 10_000);
    expect(output).toContain('my-tools');
    expect(output).toContain('python');

    // Verify groups.json
    const groups = readGroups();
    expect(groups['my-tools']).toEqual([]);
    expect(groups['python']).toEqual([]);
  });

  it('group create rejects duplicate name', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create dup');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create dup');
    const output = await tmux.waitForText(/already exists/, 10_000);
    expect(output).toContain('already exists');
  });

  it('group delete removes group', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create temp');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group delete temp');
    await tmux.waitForText(/Deleted group/, 10_000);
    tmux.destroy();

    const groups = readGroups();
    expect(groups['temp']).toBeUndefined();
  });

  it('group delete nonexistent shows error', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group delete nope');
    const output = await tmux.waitForText(/not found/, 10_000);
    expect(output).toContain('not found');
  });

  it('group add and group list <name> show skill references', async () => {
    await setup();

    // Install a local skill first
    createLocalSkill('my-linter');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-linter', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Add skill to group via group add
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add python my-linter');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // List group details — shows skill name, no source suffix for custom
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group list python');
    const output = await tmux.waitForText(/my-linter/, 10_000);
    expect(output).toContain('my-linter');
    expect(output).not.toContain('custom/my-linter');

    // Verify groups.json
    const groups = readGroups();
    expect(groups['python']).toContain('custom/my-linter');
  });

  it('group add is idempotent for duplicate skill', async () => {
    await setup();

    createLocalSkill('dup-skill');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dup-skill', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add tools dup-skill');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // Adding again should show "already in group"
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add tools dup-skill');
    const output = await tmux.waitForText(/already in group/, 10_000);
    expect(output).toContain('already in group');

    // Verify no duplicate in groups.json
    const groups = readGroups();
    expect(groups['tools'].filter((k: string) => k === 'custom/dup-skill')).toHaveLength(1);
  });

  it('group remove removes skill from group', async () => {
    await setup();

    createLocalSkill('removable');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./removable', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Add to group
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add cleanup removable');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // Remove from group
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove cleanup removable');
    await tmux.waitForText(/Removed/, 10_000);
    tmux.destroy();

    // Group should be empty
    const groups = readGroups();
    expect(groups['cleanup']).toEqual([]);

    // Skill still exists in central repo (not uninstalled)
    const skillDir = join(env.homeDir, '.skills-manager', 'custom', 'removable');
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);
  });

  it('uninstall cleans up group references', async () => {
    await setup();

    createLocalSkill('ephemeral');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./ephemeral --group auto-grp', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Verify group has the skill
    let groups = readGroups();
    expect(groups['auto-grp']).toContain('custom/ephemeral');

    // Uninstall the skill
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall ephemeral -f');
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    // Group should no longer reference the skill
    groups = readGroups();
    expect(groups['auto-grp'] ?? []).not.toContain('custom/ephemeral');
  });
});

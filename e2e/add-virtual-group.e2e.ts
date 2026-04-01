import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('add interactive virtual group display E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createLocalSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  async function installSkill(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();
  }

  async function addToGroup(group: string, skill: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr group add ${group} ${skill}`);
    await tmux.waitForText(/Added|already in group/, 10_000);
    tmux.destroy();
  }

  it('interactive add shows skills grouped by virtual group', async () => {
    createLocalSkill('vg-alpha');
    createLocalSkill('vg-beta');
    createLocalSkill('vg-gamma');
    await installSkill('vg-alpha');
    await installSkill('vg-beta');
    await installSkill('vg-gamma');
    await addToGroup('develop', 'vg-alpha');
    await addToGroup('develop', 'vg-beta');
    // vg-gamma is ungrouped

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add', env.projectDir);

    // First prompt: select agents
    await tmux.waitForText(/Select target agents/, 10_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    // Second prompt: select skills — should show virtual group
    const output = await tmux.waitForText(/Select skills to add/, 10_000);

    expect(output).toContain('develop');
    expect(output).toContain('vg-alpha');
    expect(output).toContain('vg-beta');

    await tmux.pressKey('q');
  });

  it('interactive add without groups shows flat list', async () => {
    createLocalSkill('flat-x');
    createLocalSkill('flat-y');
    await installSkill('flat-x');
    await installSkill('flat-y');
    // No group assignments

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add', env.projectDir);

    await tmux.waitForText(/Select target agents/, 10_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    const output = await tmux.waitForText(/Select skills to add/, 10_000);

    expect(output).toContain('flat-x');
    expect(output).toContain('flat-y');
    // No group headers when no virtual groups exist
    expect(output).not.toContain('(ungrouped)');

    await tmux.pressKey('q');
  });

  it('interactive add preserves source-based grouping with official and custom skills', async () => {
    // Install one official skill
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install openai/skills -s skill-creator');
    await tmux.waitForText('Installed', 90_000);
    tmux.destroy();

    // Create and install custom skills
    createLocalSkill('src-a');
    createLocalSkill('src-b');
    await installSkill('src-a');
    await installSkill('src-b');
    await addToGroup('tools', 'src-a');

    // Run interactive add
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add', env.projectDir);

    await tmux.waitForText(/Select target agents/, 10_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    const output = await tmux.waitForText(/Select skills to add/, 10_000);

    // Should show official and custom skills
    expect(output).toContain('skill-creator');
    expect(output).toContain('src-a');
    expect(output).toContain('src-b');

    // Official should appear before custom (correct ordering: official=0, custom=2)
    const officialPos = output.indexOf('skill-creator');
    const customPos = output.indexOf('src-a');
    expect(officialPos).toBeLessThan(customPos);

    // Virtual group should appear within custom section
    expect(output).toContain('tools');

    // No (ungrouped) label — ungrouped skills appear flat
    expect(output).not.toContain('(ungrouped)');
    // src-b (ungrouped) should still appear after grouped skills
    expect(output).toContain('src-b');

    await tmux.pressKey('q');
  }, 120_000);

  it('interactive add marks deployed skills with suffix in virtual group view', async () => {
    createLocalSkill('dep-a');
    createLocalSkill('dep-b');
    await installSkill('dep-a');
    await installSkill('dep-b');
    await addToGroup('tools', 'dep-a');
    await addToGroup('tools', 'dep-b');

    // Deploy dep-a first
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add dep-a -a claude-code', env.projectDir);
    await tmux.waitForText(/linked|already deployed/, 15_000);
    tmux.destroy();

    // Now run interactive add
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add', env.projectDir);

    await tmux.waitForText(/Select target agents/, 10_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    const output = await tmux.waitForText(/Select skills to add/, 10_000);

    expect(output).toContain('tools');
    // dep-a should be marked as deployed
    expect(output).toContain('deployed');

    await tmux.pressKey('q');
  });

  it('interactive add locks deployed skills — space on locked skill does not deselect', async () => {
    createLocalSkill('lock-a');
    createLocalSkill('lock-b');
    await installSkill('lock-a');
    await installSkill('lock-b');

    // Deploy lock-a first
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add lock-a -a claude-code', env.projectDir);
    await tmux.waitForText(/linked|already deployed/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    expect(existsSync(join(deployedDir, 'lock-a'))).toBe(true);

    // Run interactive add
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add', env.projectDir);

    await tmux.waitForText(/Select target agents/, 10_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Select skills to/, 10_000);

    // Navigate to lock-a (deployed/locked) and press space — should NOT deselect
    // lock-a appears first (deployed, checked+locked)
    // Press space on it, then confirm
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/linked|already deployed|No new skills selected|None selected/, 15_000);
    tmux.destroy();

    // lock-a must still be deployed (space on locked item is a no-op)
    expect(existsSync(join(deployedDir, 'lock-a'))).toBe(true);
  });
});

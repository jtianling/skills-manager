import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('uninstall interactive virtual group display E2E', () => {
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

  it('interactive uninstall shows skills grouped by virtual group', async () => {
    createLocalSkill('ui-a');
    createLocalSkill('ui-b');
    createLocalSkill('ui-c');
    await installSkill('ui-a');
    await installSkill('ui-b');
    await installSkill('ui-c');
    await addToGroup('develop', 'ui-a');
    await addToGroup('develop', 'ui-b');
    // ui-c is ungrouped

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall');
    const output = await tmux.waitForText(/Select skills to uninstall/, 10_000);

    // Should show virtual group header
    expect(output).toContain('develop');
    expect(output).toContain('ui-a');
    expect(output).toContain('ui-b');

    await tmux.pressKey('q');
  });

  it('interactive uninstall without groups shows flat list', async () => {
    createLocalSkill('no-grp-a');
    createLocalSkill('no-grp-b');
    await installSkill('no-grp-a');
    await installSkill('no-grp-b');
    // No group assignments

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall');
    const output = await tmux.waitForText(/Select skills to uninstall/, 10_000);

    expect(output).toContain('no-grp-a');
    expect(output).toContain('no-grp-b');
    // No group headers when no virtual groups exist
    expect(output).not.toContain('(ungrouped)');

    await tmux.pressKey('q');
  });

  it('interactive uninstall preserves source-based grouping with official and custom skills', async () => {
    // Install one official skill
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install openai/skills -s skill-creator');
    await tmux.waitForText('Installed', 90_000);
    tmux.destroy();

    // Create and install custom skills
    createLocalSkill('src-x');
    createLocalSkill('src-y');
    await installSkill('src-x');
    await installSkill('src-y');
    await addToGroup('dev', 'src-x');

    // Run interactive uninstall (shows ALL installed skills)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall');
    const output = await tmux.waitForText(/Select skills to uninstall/, 10_000);

    // Should show official and custom skills
    expect(output).toContain('skill-creator');
    expect(output).toContain('src-x');
    expect(output).toContain('src-y');

    // Official should appear before custom
    const officialPos = output.indexOf('skill-creator');
    const customPos = output.indexOf('src-x');
    expect(officialPos).toBeLessThan(customPos);

    // Virtual group should appear within custom section
    expect(output).toContain('dev');

    // Ungrouped after grouped
    const devPos = output.indexOf('dev');
    const ungroupedPos = output.indexOf('(ungrouped)');
    expect(ungroupedPos).toBeGreaterThan(devPos);

    await tmux.pressKey('q');
  }, 120_000);

  it('interactive uninstall shows ungrouped skills after named groups', async () => {
    createLocalSkill('grp-skill');
    createLocalSkill('loose-skill');
    await installSkill('grp-skill');
    await installSkill('loose-skill');
    await addToGroup('my-group', 'grp-skill');
    // loose-skill is ungrouped

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall');
    const output = await tmux.waitForText(/Select skills to uninstall/, 10_000);

    expect(output).toContain('my-group');
    expect(output).toContain('grp-skill');
    expect(output).toContain('loose-skill');

    // (ungrouped) should appear after named group
    const groupPos = output.indexOf('my-group');
    const ungroupedPos = output.indexOf('(ungrouped)');
    expect(ungroupedPos).toBeGreaterThan(groupPos);

    await tmux.pressKey('q');
  });
});

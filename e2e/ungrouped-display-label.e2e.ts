import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('ungrouped display label E2E', () => {
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
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();
  }

  function createLocalSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  function installLocalSkill(name: string, extraArgs = ''): Promise<void> {
    return (async () => {
      tmux = new TmuxSession(env);
      await tmux.start(`skillsmgr install ./${name} ${extraArgs}`.trim(), env.projectDir);
      await tmux.waitForText(/Installed|installed/, 15_000);
      tmux.destroy();
    })();
  }

  it('list shows (ungrouped) label for custom skills without group', async () => {
    await setup();

    createLocalSkill('solo-a');
    createLocalSkill('solo-b');
    await installLocalSkill('solo-a');
    await installLocalSkill('solo-b');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText(/\(ungrouped\)/, 10_000);

    expect(output).toContain('── custom');
    expect(output).toContain('(ungrouped)');
    expect(output).toContain('solo-a');
    expect(output).toContain('solo-b');
  });

  it('list shows (ungrouped) after real groups in custom category', async () => {
    await setup();

    // Create a directory with a skill inside to trigger batch install (physical group)
    const groupDir = join(env.projectDir, 'my-tools');
    const skillInGroup = join(groupDir, 'grouped-skill');
    mkdirSync(skillInGroup, { recursive: true });
    writeFileSync(
      join(skillInGroup, 'SKILL.md'),
      '---\nname: grouped-skill\ndescription: A grouped skill\n---\n# grouped-skill\n',
    );

    // Install directory (creates physical custom/my-tools/grouped-skill)
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./my-tools`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Install a loose skill (no group)
    createLocalSkill('loose-skill');
    await installLocalSkill('loose-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText(/\(ungrouped\)/, 10_000);

    expect(output).toContain('── custom');
    expect(output).toContain('my-tools');
    expect(output).toContain('(ungrouped)');
    expect(output).toContain('grouped-skill');
    expect(output).toContain('loose-skill');

    // (ungrouped) must appear AFTER the real group
    const myToolsPos = output.indexOf('my-tools');
    const ungroupedPos = output.indexOf('(ungrouped)');
    expect(ungroupedPos).toBeGreaterThan(myToolsPos);
  });

  it('list shows only (ungrouped) when all custom skills are ungrouped', async () => {
    await setup();

    createLocalSkill('only-one');
    await installLocalSkill('only-one');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText(/\(ungrouped\)/, 10_000);

    expect(output).toContain('── custom');
    expect(output).toContain('(ungrouped)');
    expect(output).toContain('only-one');
  });
});

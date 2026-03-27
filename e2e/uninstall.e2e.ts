import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('uninstall E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  async function setupAndInstall(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropic --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();
  }

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('uninstall -f removes skill without prompting', async () => {
    await setupAndInstall();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skillsBefore = readdirSync(skillsDir);
    const targetSkill = skillsBefore[0];

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr uninstall ${targetSkill} -f`);
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);

    const skillPath = join(skillsDir, targetSkill);
    expect(existsSync(skillPath)).toBe(false);
  });

  it('uninstall with confirmation prompt', async () => {
    await setupAndInstall();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skillsBefore = readdirSync(skillsDir);
    const targetSkill = skillsBefore[0];

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr uninstall ${targetSkill}`);
    await tmux.waitForText(/confirm|Remove|remove/i, 15_000);

    await tmux.pressKey('y');
    await tmux.pressEnter();

    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
  });
});

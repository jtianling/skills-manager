import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames } from './helpers/skills.js';

describe('install → reinstall → uninstall cycle E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('install openai/skills skill-creator → reinstall finds all skills → uninstall removes it', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');
    const skillsDir = join(smDir, 'official', 'openai', 'skills');

    // 1. Setup
    // 2. Install openai/skills — select only skill-creator
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install openai/skills');
    await tmux.waitForText('Select skills to install', 90_000);
    await new Promise((r) => setTimeout(r, 500));

    await tmux.pressKey('/');
    await tmux.sendText('skill-creator');
    await tmux.waitForText('skill-creator', 5_000);
    await new Promise((r) => setTimeout(r, 300));

    await tmux.pressSpace();
    await tmux.pressEnter();
    await new Promise((r) => setTimeout(r, 300));
    await tmux.pressEnter();
    await tmux.waitForText('Installed', 30_000);
    tmux.destroy();

    // Verify skill-creator installed, no .git directory
    expect(existsSync(join(skillsDir, 'skill-creator', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, '.git'))).toBe(false);

    const installedAfterFirst = getDeployedSkillNames(skillsDir);
    expect(installedAfterFirst).toContain('skill-creator');
    // Verify only the selected skill was installed, not the entire repo
    expect(installedAfterFirst).toHaveLength(1);

    // 3. Reinstall openai/skills — verify it still finds all skills (not just the 1 already installed)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install openai/skills');
    const reinstallOutput = await tmux.waitForText('Select skills to install', 90_000);

    const foundMatch = reinstallOutput.match(/Found (\d+) skills/);
    expect(foundMatch).not.toBeNull();
    const foundCount = parseInt(foundMatch![1], 10);
    expect(foundCount).toBeGreaterThan(10);

    // Cancel selection (Ctrl+C)
    await tmux.sendKeys('C-c');
    await new Promise((r) => setTimeout(r, 500));
    tmux.destroy();

    // 4. Uninstall skill-creator
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall skill-creator -f');
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    expect(existsSync(join(skillsDir, 'skill-creator'))).toBe(false);
  });
});

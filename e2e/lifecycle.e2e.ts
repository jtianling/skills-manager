import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readdirSync, readFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('full lifecycle E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('setup → install → list → add → list --deployed → remove → uninstall', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');

    // 1. Setup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    expect(existsSync(join(smDir, 'official'))).toBe(true);

    // 2. Install --all
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropic --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(smDir, 'official', 'anthropic', 'skills');
    expect(existsSync(skillsDir)).toBe(true);
    const installedSkills = readdirSync(skillsDir);
    expect(installedSkills.length).toBeGreaterThan(0);
    const skillName = installedSkills[0];

    // 3. List
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const listOutput = await tmux.waitForText(skillName, 10_000);
    expect(listOutput).toContain('official');
    tmux.destroy();

    // 4. Add skill to project
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr add ${skillName} -a claude-code`, env.projectDir);
    await tmux.waitForText('linked', 15_000);
    tmux.destroy();

    const deployedSkill = join(env.projectDir, '.agents', 'skills', skillName);
    expect(existsSync(deployedSkill)).toBe(true);
    expect(lstatSync(deployedSkill).isSymbolicLink()).toBe(true);

    // 5. List --deployed
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list --deployed', env.projectDir);
    const deployedOutput = await tmux.waitForText(skillName, 10_000);
    expect(deployedOutput).toContain('link');
    tmux.destroy();

    // 6. Remove from project
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr remove ${skillName}`, env.projectDir);
    await tmux.waitForText('Removed', 10_000);
    tmux.destroy();

    expect(existsSync(deployedSkill)).toBe(false);

    // 7. Uninstall from central repo
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr uninstall ${skillName} -f`);
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
    tmux.destroy();

    const skillPath = join(skillsDir, skillName);
    expect(existsSync(skillPath)).toBe(false);

    // Verify sources.json is updated
    const sourcesPath = join(smDir, 'sources.json');
    expect(existsSync(sourcesPath)).toBe(true);
  });
});

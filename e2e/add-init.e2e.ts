import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, lstatSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getInstalledSkillNames } from './helpers/skills.js';

describe('add E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;
  let skillName: string;

  async function setupAndInstall(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skills = getInstalledSkillNames(skillsDir);
    skillName = skills[0];
  }

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('add with -a flag deploys skill as symlink', async () => {
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr add ${skillName} -a claude-code`, env.projectDir);
    await tmux.waitForText('linked', 15_000);

    const skillPath = join(env.projectDir, '.agents', 'skills', skillName);
    expect(existsSync(skillPath)).toBe(true);
    expect(lstatSync(skillPath).isSymbolicLink()).toBe(true);

    const bridgePath = join(env.projectDir, '.claude', 'skills');
    expect(existsSync(bridgePath)).toBe(true);
    expect(lstatSync(bridgePath).isSymbolicLink()).toBe(true);
  });

  it('add with --copy deploys as real directory', async () => {
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr add ${skillName} -a claude-code --copy`, env.projectDir);
    await tmux.waitForText('copied', 15_000);

    const skillPath = join(env.projectDir, '.agents', 'skills', skillName);
    expect(existsSync(skillPath)).toBe(true);
    expect(lstatSync(skillPath).isSymbolicLink()).toBe(false);
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, lstatSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames, getInstalledSkillNames } from './helpers/skills.js';

describe('deploy E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function installSkills(): Promise<string[]> {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    return getInstalledSkillNames(skillsDir);
  }

  it('deploy deploys skills via interactive agent and skill selection', async () => {
    env = createTestEnv();
    const skills = await installSkills();
    expect(skills.length).toBeGreaterThan(0);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr deploy', env.projectDir);

    await tmux.waitForText('Select target agents', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText('Select skills to deploy', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Done|Deployed/, 15_000);

    const agentsSkillsDir = join(env.projectDir, '.agents', 'skills');
    expect(existsSync(agentsSkillsDir)).toBe(true);

    const deployed = getDeployedSkillNames(agentsSkillsDir);
    expect(deployed.length).toBeGreaterThan(0);
    expect(lstatSync(join(agentsSkillsDir, deployed[0])).isSymbolicLink()).toBe(true);
  });

  it('deploy --copy deploys copies instead of symlinks', async () => {
    env = createTestEnv();
    await installSkills();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr deploy --copy', env.projectDir);

    await tmux.waitForText('Select target agents', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText('Select skills to deploy', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Done|Deployed/, 15_000);

    const agentsSkillsDir = join(env.projectDir, '.agents', 'skills');
    expect(existsSync(agentsSkillsDir)).toBe(true);

    const deployed = getDeployedSkillNames(agentsSkillsDir);
    expect(deployed.length).toBeGreaterThan(0);
    expect(lstatSync(join(agentsSkillsDir, deployed[0])).isSymbolicLink()).toBe(false);
  });

  it('deploy -g deploys skills to global agent directory', async () => {
    env = createTestEnv();
    await installSkills();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr deploy -g', env.projectDir);

    await tmux.waitForText('Select target agents for global install', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText('Select skills to deploy', 15_000);
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Done! Deployed \d+ skills globally/, 15_000);

    const globalSkillsDir = join(env.homeDir, '.claude', 'skills');
    expect(existsSync(globalSkillsDir)).toBe(true);

    const deployed = getDeployedSkillNames(globalSkillsDir);
    expect(deployed.length).toBeGreaterThan(0);
    expect(lstatSync(join(globalSkillsDir, deployed[0])).isSymbolicLink()).toBe(true);
  });
});

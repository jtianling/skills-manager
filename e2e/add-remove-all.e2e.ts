import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames, getInstalledSkillNames } from './helpers/skills.js';

describe('add/remove --all and -y E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function setupAndInstall(): Promise<{
    skillsDir: string;
    skills: string[];
  }> {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(
      env.homeDir,
      '.skills-manager',
      'official',
      'anthropic',
      'skills',
    );
    const skills = getInstalledSkillNames(skillsDir);
    expect(skills.length).toBeGreaterThanOrEqual(2);
    return { skillsDir, skills };
  }

  async function deployAll(skills: string[]): Promise<void> {
    for (const skill of skills) {
      tmux = new TmuxSession(env);
      await tmux.start(
        `skillsmgr add ${skill} -a claude-code`,
        env.projectDir,
      );
      await tmux.waitForText(/linked|already deployed/, 15_000);
      tmux.destroy();
    }
  }

  it('add owner/repo --all deploys all skills without prompting', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills --all -a claude-code',
      env.projectDir,
    );
    await tmux.waitForText(/linked|✓/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const deployed = getDeployedSkillNames(deployedDir);
    for (const skill of skills) {
      expect(deployed).toContain(skill);
    }
  });

  it('add owner/repo -y deploys all skills without prompting', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills -y -a claude-code',
      env.projectDir,
    );
    await tmux.waitForText(/linked|✓/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const deployed = getDeployedSkillNames(deployedDir);
    for (const skill of skills) {
      expect(deployed).toContain(skill);
    }
  });

  it('remove owner/repo --all removes all deployed skills without prompting', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    await deployAll(skills);

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    expect(getDeployedSkillNames(deployedDir).length).toBe(skills.length);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove anthropics/skills --all',
      env.projectDir,
    );
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    for (const skill of skills) {
      expect(existsSync(join(deployedDir, skill))).toBe(false);
    }
  });

  it('remove owner/repo -y removes all deployed skills without prompting', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    await deployAll(skills);

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    expect(getDeployedSkillNames(deployedDir).length).toBe(skills.length);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove anthropics/skills -y',
      env.projectDir,
    );
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    for (const skill of skills) {
      expect(existsSync(join(deployedDir, skill))).toBe(false);
    }
  });

  it('remove with no args enters interactive mode', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const skill = skills[0];

    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add ${skill} -a claude-code`,
      env.projectDir,
    );
    await tmux.waitForText(/linked/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    expect(existsSync(join(deployedDir, skill))).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    await tmux.waitForText(/Select skills to remove/, 10_000);

    // Select the skill and confirm
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    expect(existsSync(join(deployedDir, skill))).toBe(false);
  });
});

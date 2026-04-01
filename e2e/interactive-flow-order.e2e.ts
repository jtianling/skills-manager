import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, symlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames, getInstalledSkillNames } from './helpers/skills.js';

describe('interactive flow order E2E', () => {
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

  function configureAgents(skill: string): void {
    tmux = new TmuxSession(env);
    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const skillsDir = join(
      env.homeDir,
      '.skills-manager',
      'official',
      'anthropic',
      'skills',
    );
    mkdirSync(deployedDir, { recursive: true });
    symlinkSync(join(skillsDir, skill), join(deployedDir, skill));

    const claudeSkillsDir = join(env.projectDir, '.claude', 'skills');
    mkdirSync(join(env.projectDir, '.claude'), { recursive: true });
    symlinkSync(join(env.projectDir, '.agents', 'skills'), claudeSkillsDir);
  }

  it('add owner/repo shows agent selection first, then skill selection', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills',
      env.projectDir,
    );

    const agentOutput = await tmux.waitForText('Select target agents', 15_000);
    expect(agentOutput).toContain('Select target agents');
    expect(agentOutput).not.toContain('Select skills to add');

    await tmux.pressSpace();
    await tmux.pressEnter();

    const skillOutput = await tmux.waitForText('Select skills to add', 15_000);
    expect(skillOutput).toContain('Select skills to add');
  });

  it('add owner/repo -a skips agent selection, shows skill selection directly', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills -a claude-code',
      env.projectDir,
    );

    const output = await tmux.waitForText('Select skills to add', 15_000);
    expect(output).toContain('Select skills to add');
    expect(output).not.toContain('Select target agents');
  });

  it('add owner/repo -y deploys all to configured agents without interaction', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const firstSkill = skills[0];

    configureAgents(firstSkill);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills -y',
      env.projectDir,
    );
    await tmux.waitForText(/linked|✓|already deployed/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const deployed = getDeployedSkillNames(deployedDir);
    expect(deployed.length).toBeGreaterThanOrEqual(2);
  });

  it('add owner/repo -s skill -y deploys specific skill to configured agents', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const firstSkill = skills[0];
    const secondSkill = skills[1];

    configureAgents(firstSkill);

    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add anthropics/skills -s ${secondSkill} -y`,
      env.projectDir,
    );
    await tmux.waitForText(/linked|✓/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const deployed = getDeployedSkillNames(deployedDir);
    expect(deployed).toContain(secondSkill);
    expect(deployed).toContain(firstSkill);
  });

  it('add owner/repo --same-agents --all deploys without interaction', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const firstSkill = skills[0];

    configureAgents(firstSkill);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills --same-agents --all',
      env.projectDir,
    );
    await tmux.waitForText(/linked|✓|already deployed/, 15_000);
    tmux.destroy();

    const deployedDir = join(env.projectDir, '.agents', 'skills');
    const deployed = getDeployedSkillNames(deployedDir);
    expect(deployed.length).toBeGreaterThanOrEqual(2);
  });

  it('add owner/repo -y with no configured agents shows error', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills -y',
      env.projectDir,
    );
    const output = await tmux.waitForText(/No agents configured/, 10_000);
    expect(output).toContain('No agents configured');
  });

  it('remove owner/repo -y removes all without interaction when agents configured', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();

    for (const skill of skills) {
      tmux = new TmuxSession(env);
      await tmux.start(
        `skillsmgr add ${skill} -a claude-code`,
        env.projectDir,
      );
      await tmux.waitForText(/linked|already deployed/, 15_000);
      tmux.destroy();
    }

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
});

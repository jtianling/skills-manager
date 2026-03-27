import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, lstatSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getInstalledSkillNames } from './helpers/skills.js';

describe('flags lifecycle E2E', () => {
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

  it('install --skill filters specific skills', async () => {
    env = createTestEnv();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // First install all to discover actual skill names
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
    const allSkills = getInstalledSkillNames(skillsDir);
    expect(allSkills.length).toBeGreaterThanOrEqual(3);
    const skill1 = allSkills[0];
    const skill2 = allSkills[1];

    // Uninstall all, then reinstall with --skill filter
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Uninstalled/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr install anthropics/skills -s ${skill1} -s ${skill2}`,
    );
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const filtered = getInstalledSkillNames(skillsDir);
    expect(filtered).toContain(skill1);
    expect(filtered).toContain(skill2);
    expect(filtered.length).toBe(2);
  });

  it('add -s -a → remove -s: project-level, no interaction', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const skill1 = skills[0];
    const skill2 = skills[1];

    // Add two specific skills with specific agent — zero interaction
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add anthropics/skills -s ${skill1} -s ${skill2} -a claude-code`,
      env.projectDir,
    );
    await tmux.waitForText('linked', 15_000);
    tmux.destroy();

    const deployed1 = join(env.projectDir, '.agents', 'skills', skill1);
    const deployed2 = join(env.projectDir, '.agents', 'skills', skill2);
    expect(existsSync(deployed1)).toBe(true);
    expect(existsSync(deployed2)).toBe(true);

    // Remove one specific skill via -s
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr remove -s ${skill1}`,
      env.projectDir,
    );
    await tmux.waitForText('Removed', 10_000);
    tmux.destroy();

    expect(existsSync(deployed1)).toBe(false);
    expect(existsSync(deployed2)).toBe(true);

    // Remove remaining skill via positional arg
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr remove ${skill2}`,
      env.projectDir,
    );
    await tmux.waitForText('Removed', 10_000);
    tmux.destroy();

    expect(existsSync(deployed2)).toBe(false);
  });

  it('add -g -a → remove -g -a: global lifecycle', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();
    const skill = skills[0];

    // Add globally to claude-code
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add ${skill} -g -a claude-code`,
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|✓/, 15_000);
    tmux.destroy();

    // Verify skill exists in global dir
    const globalDir = join(env.homeDir, '.claude', 'skills');
    expect(existsSync(join(globalDir, skill))).toBe(true);

    // Remove globally from claude-code
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr remove ${skill} -g -a claude-code`,
      env.projectDir,
    );
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    expect(existsSync(join(globalDir, skill))).toBe(false);
  });

  it('full lifecycle: install → add -s -a → remove -s → uninstall -s', async () => {
    env = createTestEnv();
    const { skills, skillsDir } = await setupAndInstall();
    const skill = skills[0];

    // 1. Add to project with -s -a (no interaction)
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add anthropics/skills -s ${skill} -a claude-code`,
      env.projectDir,
    );
    await tmux.waitForText('linked', 15_000);
    tmux.destroy();

    const deployedPath = join(env.projectDir, '.agents', 'skills', skill);
    expect(existsSync(deployedPath)).toBe(true);
    expect(lstatSync(deployedPath).isSymbolicLink()).toBe(true);

    // 2. Remove from project with -s
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr remove -s ${skill}`,
      env.projectDir,
    );
    await tmux.waitForText('Removed', 10_000);
    tmux.destroy();

    expect(existsSync(deployedPath)).toBe(false);

    // 3. Uninstall from central repo with -s
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr uninstall -s ${skill} -f`);
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
    tmux.destroy();

    expect(existsSync(join(skillsDir, skill))).toBe(false);
  });

  it('add -s nonexistent skill shows error', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add anthropics/skills -s nonexistent-skill -a claude-code',
      env.projectDir,
    );
    const output = await tmux.waitForText('not found', 10_000);
    tmux.destroy();

    expect(output).toContain("Skill 'nonexistent-skill' not found");
  });

  it('add -a invalid-agent shows error', async () => {
    env = createTestEnv();
    const { skills } = await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add ${skills[0]} -a fake-agent`,
      env.projectDir,
    );
    const output = await tmux.waitForText('Unknown agent', 10_000);
    tmux.destroy();

    expect(output).toContain("Unknown agent: 'fake-agent'");
  });

  it('remove with no args shows usage error', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    const output = await tmux.waitForText('No skill specified', 10_000);
    tmux.destroy();

    expect(output).toContain('No skill specified');
  });
});

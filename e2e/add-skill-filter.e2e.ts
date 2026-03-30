import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getInstalledSkillNames } from './helpers/skills.js';

describe('add -s skill filter E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('add -s installs only the specified skill, not the entire repo', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');
    const skillsDir = join(smDir, 'official', 'openai', 'skills');

    // 1. Setup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // 2. Add with -s filter — should only install skill-creator
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add openai/skills -s skill-creator -a claude-code -g',
    );
    await tmux.waitForText('Installed', 110_000);
    const output = await tmux.waitForText(/linked|copied/, 15_000);
    tmux.destroy();

    // Verify output says "Found 1 skill"
    expect(output).toMatch(/Found 1 skill\b/);

    // Verify only skill-creator is installed in central repo
    const installed = getInstalledSkillNames(skillsDir);
    expect(installed).toContain('skill-creator');
    expect(installed).toHaveLength(1);

    // Verify skill-creator is deployed globally
    const globalSkill = join(env.homeDir, '.claude', 'skills', 'skill-creator');
    expect(existsSync(globalSkill)).toBe(true);
  });

  it('add -s with multiple skills installs only those skills', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');

    // 1. Setup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // 2. First install all to discover skill names
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const anthropicSkillsDir = join(smDir, 'official', 'anthropic', 'skills');
    const allSkills = getInstalledSkillNames(anthropicSkillsDir);
    expect(allSkills.length).toBeGreaterThanOrEqual(3);
    const skill1 = allSkills[0];
    const skill2 = allSkills[1];

    // 3. Uninstall all
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Uninstalled/, 10_000);
    tmux.destroy();

    // 4. Add with -s filter for two specific skills
    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add anthropics/skills -s ${skill1} -s ${skill2} -a claude-code -g`,
    );
    const output = await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    // Verify output says "Found 2 skills"
    expect(output).toMatch(/Found 2 skills/);

    // Verify only the two specified skills are installed
    const installed = getInstalledSkillNames(anthropicSkillsDir);
    expect(installed).toContain(skill1);
    expect(installed).toContain(skill2);
    expect(installed).toHaveLength(2);
  });

  it('remove one skill does not affect other deployed skills', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');

    // 1. Setup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // 2. Install all to get skill names
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(smDir, 'official', 'anthropic', 'skills');
    const allSkills = getInstalledSkillNames(skillsDir);
    const skill1 = allSkills[0];
    const skill2 = allSkills[1];

    // 3. Add two skills to project
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

    // 4. Remove only skill1
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr remove -s ${skill1}`, env.projectDir);
    await tmux.waitForText('Removed', 10_000);
    tmux.destroy();

    // Verify skill1 removed, skill2 untouched
    expect(existsSync(deployed1)).toBe(false);
    expect(existsSync(deployed2)).toBe(true);
  });

  it('uninstall one skill does not affect other skills in same repo', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');

    // 1. Setup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // 2. Install all
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(smDir, 'official', 'anthropic', 'skills');
    const allSkills = getInstalledSkillNames(skillsDir);
    expect(allSkills.length).toBeGreaterThanOrEqual(2);
    const target = allSkills[0];
    const remaining = allSkills.slice(1);

    // 3. Uninstall one skill
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr uninstall ${target} -f`);
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
    tmux.destroy();

    // Verify target removed
    expect(existsSync(join(skillsDir, target))).toBe(false);

    // Verify all other skills still exist
    for (const skill of remaining) {
      expect(existsSync(join(skillsDir, skill, 'SKILL.md'))).toBe(true);
    }
  });
});

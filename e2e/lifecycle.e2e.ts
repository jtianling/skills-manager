import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames, getInstalledSkillNames } from './helpers/skills.js';

describe('full lifecycle E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('install → list → add → list --deployed → remove → uninstall', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');

    // 1. Install --all (auto-setup triggers automatically)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(smDir, 'official', 'anthropic', 'skills');
    expect(existsSync(skillsDir)).toBe(true);
    const installedSkills = getInstalledSkillNames(skillsDir);
    expect(installedSkills.length).toBeGreaterThan(1);
    const skillName = installedSkills[0];
    const otherSkills = installedSkills.slice(1);

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

    // Verify only the target skill was deployed, no extras
    expect(getDeployedSkillNames(join(env.projectDir, '.agents', 'skills'))).toEqual([skillName]);

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

    expect(existsSync(join(skillsDir, skillName))).toBe(false);

    // Verify other skills in the same repo are not affected
    for (const skill of otherSkills) {
      expect(existsSync(join(skillsDir, skill, 'SKILL.md'))).toBe(true);
    }

    // Verify sources.json is updated
    const sourcesPath = join(smDir, 'sources.json');
    expect(existsSync(sourcesPath)).toBe(true);
  });
});

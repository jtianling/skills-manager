import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getInstalledSkillNames } from './helpers/skills.js';

describe('uninstall via URL E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  async function setupAndInstall(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
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

  it('uninstall via HTTPS URL removes skills (same as owner/repo)', async () => {
    await setupAndInstall();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skillsBefore = getInstalledSkillNames(skillsDir);
    expect(skillsBefore.length).toBeGreaterThan(0);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall https://github.com/anthropics/skills -y');
    await tmux.waitForText(/Removed|Uninstalled/, 30_000);

    expect(existsSync(skillsDir)).toBe(false);
  });

  it('uninstall via HTTPS URL with .git suffix', async () => {
    await setupAndInstall();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skillsBefore = getInstalledSkillNames(skillsDir);
    expect(skillsBefore.length).toBeGreaterThan(0);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall https://github.com/anthropics/skills.git -y');
    await tmux.waitForText(/Removed|Uninstalled/, 30_000);

    expect(existsSync(skillsDir)).toBe(false);
  });

  it('uninstall via SSH URL removes skills', async () => {
    await setupAndInstall();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const skillsBefore = getInstalledSkillNames(skillsDir);
    expect(skillsBefore.length).toBeGreaterThan(0);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall git@github.com:anthropics/skills.git -y');
    await tmux.waitForText(/Removed|Uninstalled/, 30_000);

    expect(existsSync(skillsDir)).toBe(false);
  });

  it('uninstall via unparseable URL shows not found error', async () => {
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall https://example.com/');
    await tmux.waitForText(/not found|error/i, 15_000);
  });
});

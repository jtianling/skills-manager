import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('skill disambiguation E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function setup(): Promise<void> {
  }

  function createAndInstallSingleSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Standalone ${name}\n---\n# ${name}\nA standalone skill.\n`,
    );
  }

  function createSkillDirectory(dirName: string, skillNames: string[]): string {
    const dir = join(env.projectDir, dirName);
    mkdirSync(dir, { recursive: true });
    for (const name of skillNames) {
      const skillDir = join(dir, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${dirName} ${name}\n---\n# ${name}\nA test skill.\n`,
      );
    }
    return dir;
  }

  async function setupDuplicateSkills(): Promise<void> {
    await setup();

    // Install standalone skill
    createAndInstallSingleSkill('dup-skill');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dup-skill', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Batch install directory containing same-name skill
    createSkillDirectory('dev-dir', ['dup-skill', 'other']);
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dev-dir --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Verify both exist
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dup-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-dir', 'dup-skill', 'SKILL.md'))).toBe(true);
  }

  it('uninstall bare name with multiple matches shows disambiguation prompt', async () => {
    await setupDuplicateSkills();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall dup-skill');
    const output = await tmux.waitForText(/Multiple skills found|custom\/dup-skill|custom\/dev-dir\/dup-skill/, 15_000);

    // Should show both options
    expect(output).toMatch(/custom\/dup-skill/);
    expect(output).toMatch(/custom\/dev-dir\/dup-skill/);
  });

  it('uninstall with full key skips disambiguation', async () => {
    await setupDuplicateSkills();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall custom/dev-dir/dup-skill -f');
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);

    // Only the batch-installed one should be removed
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-dir', 'dup-skill'))).toBe(false);
    // Standalone one should still exist
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dup-skill', 'SKILL.md'))).toBe(true);
  });

  it('bare name with unique match works without disambiguation', async () => {
    await setupDuplicateSkills();

    // 'other' has no duplicate, should work directly
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall other -f');
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);

    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-dir', 'other'))).toBe(false);
    // dup-skill instances should not be affected
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dup-skill', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-dir', 'dup-skill', 'SKILL.md'))).toBe(true);
  });

  it('full key that does not exist shows error', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall custom/nonexistent/fake-skill -f');
    const output = await tmux.waitForText(/not found|Error/i, 15_000);
    expect(output).toMatch(/not found|Error/i);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('batch install same-name skill coexistence E2E', () => {
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

  function createSkillInDir(parentDir: string, skillName: string): void {
    const skillDir = join(parentDir, skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${skillName}\ndescription: Test skill ${skillName}\n---\n# ${skillName}\nA test skill.\n`,
    );
  }

  function createSkillDirectory(dirName: string, skillNames: string[]): string {
    const dir = join(env.projectDir, dirName);
    mkdirSync(dir, { recursive: true });
    for (const name of skillNames) {
      createSkillInDir(dir, name);
    }
    return dir;
  }

  function installSingleSkill(name: string): string {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Standalone ${name}\n---\n# ${name}\nA standalone skill.\n`,
    );
    return skillDir;
  }

  function readJson(relativePath: string): Record<string, unknown> {
    const fullPath = join(env.homeDir, '.skills-manager', relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8'));
  }

  it('batch install creates skills alongside existing same-name skill', async () => {
    await setup();

    // Install a single skill first
    installSingleSkill('shared-name');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./shared-name', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Verify standalone skill is at custom/shared-name/
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'shared-name', 'SKILL.md'))).toBe(true);

    // Batch install a directory that contains a skill with the same name
    createSkillDirectory('dev-pack', ['shared-name', 'unique-skill']);
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dev-pack --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    // Both should coexist
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'shared-name', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-pack', 'shared-name', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'dev-pack', 'unique-skill', 'SKILL.md'))).toBe(true);
  });

  it('batch install source key includes subdirectory', async () => {
    await setup();
    createSkillDirectory('my-dir', ['skill-x', 'skill-y']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-dir --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const sources = readJson('sources.json') as { sources: Record<string, unknown> };
    expect(sources.sources['custom/my-dir/skill-x']).toBeDefined();
    expect(sources.sources['custom/my-dir/skill-y']).toBeDefined();
    // Should NOT have key without subdirectory
    expect(sources.sources['custom/skill-x']).toBeUndefined();
  });

  it('batch install group uses key with subdirectory', async () => {
    await setup();
    createSkillDirectory('grp-test', ['grp-skill-a', 'grp-skill-b']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./grp-test --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const groups = readJson('groups.json') as Record<string, string[]>;
    expect(groups['grp-test']).toBeDefined();
    expect(groups['grp-test']).toContain('custom/grp-test/grp-skill-a');
    expect(groups['grp-test']).toContain('custom/grp-test/grp-skill-b');
  });

  it('batch install detects installed by target path, not bare name', async () => {
    await setup();

    // Install standalone skill first
    installSingleSkill('detect-test');
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./detect-test', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // Batch install directory containing same-name skill with --all
    createSkillDirectory('batch-dir', ['detect-test', 'other-skill']);
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./batch-dir --all', env.projectDir);
    await tmux.waitForText(/Installed 2 skill/, 15_000);

    // Both skills should be installed (detect-test not skipped as "already installed")
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'batch-dir', 'detect-test', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'batch-dir', 'other-skill', 'SKILL.md'))).toBe(true);

    // Group should be created with both skills
    const groups = readJson('groups.json') as Record<string, string[]>;
    expect(groups['batch-dir']).toContain('custom/batch-dir/detect-test');
    expect(groups['batch-dir']).toContain('custom/batch-dir/other-skill');
  });
});

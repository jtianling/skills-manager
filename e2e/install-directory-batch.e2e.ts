import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('install directory as group E2E', () => {
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
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();
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

  function readJson(relativePath: string): Record<string, unknown> {
    const fullPath = join(env.homeDir, '.skills-manager', relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8'));
  }

  it('directory without SKILL.md falls back to batch install of child skills', async () => {
    await setup();
    createSkillDirectory('my-tools', ['tool-a', 'tool-b', 'tool-c']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-tools --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'my-tools', 'tool-a', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'my-tools', 'tool-b', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'my-tools', 'tool-c', 'SKILL.md'))).toBe(true);
  });

  it('directory without SKILL.md and no child skills reports error', async () => {
    await setup();
    const emptyDir = join(env.projectDir, 'empty-dir');
    mkdirSync(emptyDir, { recursive: true });

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./empty-dir', env.projectDir);
    await tmux.waitForText(/No skills found|not found|Error/i, 15_000);
  });

  it('directory with SKILL.md installs as single skill (existing behavior)', async () => {
    await setup();
    const skillDir = join(env.projectDir, 'single-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: single-skill\ndescription: A single skill\n---\n# single-skill\n',
    );

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./single-skill', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    // Stored flat under custom/, not in a subdirectory
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'single-skill', 'SKILL.md'))).toBe(true);
  });

  it('batch install stores skills in custom/{dirName}/{skillName}/ with correct skill key', async () => {
    await setup();
    createSkillDirectory('my-pack', ['pack-skill-a', 'pack-skill-b']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-pack --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    // Physical storage in subdirectory
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'my-pack', 'pack-skill-a', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'my-pack', 'pack-skill-b', 'SKILL.md'))).toBe(true);

    // Skill key does not contain subdirectory prefix
    const sources = readJson('sources.json') as { sources: Record<string, unknown> };
    expect(sources.sources['custom/pack-skill-a']).toBeDefined();
    expect(sources.sources['custom/pack-skill-b']).toBeDefined();
  });

  it('batch install auto-creates virtual group named after directory', async () => {
    await setup();
    createSkillDirectory('auto-group', ['ag-skill-a', 'ag-skill-b']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./auto-group --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const groups = readJson('groups.json') as Record<string, string[]>;
    expect(groups['auto-group']).toBeDefined();
    expect(groups['auto-group']).toContain('custom/ag-skill-a');
    expect(groups['auto-group']).toContain('custom/ag-skill-b');
  });

  it('--group overrides auto group name but physical directory stays', async () => {
    await setup();
    createSkillDirectory('orig-dir', ['override-skill']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./orig-dir --all --group my-custom-group', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    // Physical path uses original directory name
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'orig-dir', 'override-skill', 'SKILL.md'))).toBe(true);

    // Group uses --group name, not directory name
    const groups = readJson('groups.json') as Record<string, string[]>;
    expect(groups['my-custom-group']).toContain('custom/override-skill');
    expect(groups['orig-dir']).toBeUndefined();
  });

  it('list command discovers skills in two-layer custom directory', async () => {
    await setup();
    createSkillDirectory('nested-pack', ['nested-skill-a', 'nested-skill-b']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./nested-pack --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText(/nested-skill-a/, 15_000);
    expect(output).toMatch(/nested-skill-b/);
  });

  it('group add works for skills in two-layer custom directory', async () => {
    await setup();
    createSkillDirectory('two-layer', ['tl-skill']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./two-layer --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    // group add by skill name should find the two-layer skill
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add another-group tl-skill');
    await tmux.waitForText(/Added|added/i, 15_000);

    const groups = readJson('groups.json') as Record<string, string[]>;
    expect(groups['another-group']).toContain('custom/tl-skill');
  });

  it('uninstall cleans up empty parent directory after removing last skill', async () => {
    await setup();
    createSkillDirectory('cleanup-test', ['cleanup-skill']);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./cleanup-test --all', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    const parentDir = join(env.homeDir, '.skills-manager', 'custom', 'cleanup-test');
    expect(existsSync(parentDir)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall cleanup-skill -f');
    await tmux.waitForText(/Removed|Uninstalled/i, 15_000);

    // Skill directory removed
    expect(existsSync(join(parentDir, 'cleanup-skill'))).toBe(false);
    // Empty parent directory also cleaned up
    expect(existsSync(parentDir)).toBe(false);
  });
});

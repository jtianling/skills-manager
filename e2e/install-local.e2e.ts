import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('local install E2E', () => {
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

  function createLocalSkill(name: string, dir?: string): string {
    const skillDir = join(dir ?? env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
    return skillDir;
  }

  it('install bare word rejects with unknown source format', async () => {
    await setup();
    createLocalSkill('my-local-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install my-local-skill', env.projectDir);
    await tmux.waitForText(/Unknown source format/, 15_000);
  });

  it('install ./name resolves to local directory and records metadata', async () => {
    await setup();
    createLocalSkill('my-local-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-local-skill', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'my-local-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    expect(sources.sources['custom/my-local-skill']).toBeDefined();
    expect(sources.sources['custom/my-local-skill'].installMethod).toBe('local-copy');
  });

  it('install ./path resolves to local directory', async () => {
    await setup();
    createLocalSkill('dotslash-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dotslash-skill', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'dotslash-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);
  });

  it('install with --group installs flat and records virtual group', async () => {
    await setup();
    createLocalSkill('grouped-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./grouped-skill --group my-tools', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'grouped-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    expect(sources.sources['custom/grouped-skill']).toBeDefined();

    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    const groups = JSON.parse(readFileSync(groupsPath, 'utf-8'));
    expect(groups['my-tools']).toContain('custom/grouped-skill');
  });

  it('install ./nonexistent fails when directory does not exist', async () => {
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./nonexistent-skill', env.projectDir);
    await tmux.waitForText(/not found|does not exist|No such/i, 15_000);
  });

  it('install local zip file extracts and installs skill', async () => {
    await setup();
    createLocalSkill('zip-test-skill');

    const zipPath = join(env.projectDir, 'zip-test-skill.zip');
    execSync(`zip -qr "${zipPath}" zip-test-skill`, { cwd: env.projectDir });

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install "${zipPath}"`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 30_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'zip-test-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    expect(sources.sources['custom/zip-test-skill']).toBeDefined();
    expect(sources.sources['custom/zip-test-skill'].installMethod).toBe('zip');
  });

  it('install same skill into different group triggers overwrite and adds to both groups', async () => {
    await setup();
    createLocalSkill('conflict-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./conflict-skill --group group-a', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./conflict-skill --group group-b -f', env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'conflict-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    const groups = JSON.parse(readFileSync(groupsPath, 'utf-8'));
    expect(groups['group-a']).toContain('custom/conflict-skill');
    expect(groups['group-b']).toContain('custom/conflict-skill');
  });

  it('install zip with --group installs flat and records virtual group', async () => {
    await setup();
    createLocalSkill('zip-grouped-skill');

    const zipPath = join(env.projectDir, 'zip-grouped-skill.zip');
    execSync(`zip -qr "${zipPath}" zip-grouped-skill`, { cwd: env.projectDir });

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install "${zipPath}" --group zip-tools`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 30_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'zip-grouped-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    const groups = JSON.parse(readFileSync(groupsPath, 'utf-8'));
    expect(groups['zip-tools']).toContain('custom/zip-grouped-skill');
  });
});

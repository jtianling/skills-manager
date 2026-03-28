import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('update E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

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

  async function setupAndInstall(): Promise<void> {
    await setup();
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();
  }

  it('update all sources reports up to date after fresh install', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update');
    const output = await tmux.waitForText('Done!', 90_000);
    expect(output).toContain('up to date');
    expect(output).toContain('0 updated');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update specific source by key', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update official/anthropic/skills');
    const output = await tmux.waitForText('Done!', 90_000);
    expect(output).toContain('up to date');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update with no sources shows empty message', async () => {
    env = createTestEnv();
    await setup();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update');
    const output = await tmux.waitForText('No installed sources', 10_000);
    expect(output).toContain('No installed sources found');
  });

  it('update nonexistent source shows error', async () => {
    env = createTestEnv();
    await setupAndInstall();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update nonexistent');
    const output = await tmux.waitForText('not found', 10_000);
    expect(output).toContain('not found');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update local-path by name matching from different directory', async () => {
    env = createTestEnv();
    await setup();

    const originalDir = join(env.homeDir, 'source-a', 'my-local-skill');
    mkdirSync(originalDir, { recursive: true });
    writeFileSync(
      join(originalDir, 'SKILL.md'),
      '---\nname: my-local-skill\ndescription: A test skill\n---\nOriginal content',
    );

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install "${originalDir}"`);
    await tmux.waitForText('Installed', 30_000);
    tmux.destroy();

    const diffDir = join(env.homeDir, 'source-b', 'my-local-skill');
    mkdirSync(diffDir, { recursive: true });
    writeFileSync(
      join(diffDir, 'SKILL.md'),
      '---\nname: my-local-skill\ndescription: A test skill\n---\nUpdated from different dir',
    );

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr update "${diffDir}"`);
    const output = await tmux.waitForText('Done!', 10_000);
    expect(output).toContain('1 updated');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall my-local-skill -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update local-path reports not found for uninstalled skill', async () => {
    env = createTestEnv();
    await setup();

    const dummyDir = join(env.homeDir, 'dummy-installed');
    mkdirSync(dummyDir, { recursive: true });
    writeFileSync(join(dummyDir, 'SKILL.md'), '---\nname: dummy-installed\n---\n');

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install "${dummyDir}"`);
    await tmux.waitForText('Installed', 30_000);
    tmux.destroy();

    const notInstalledDir = join(env.homeDir, 'not-installed-skill');
    mkdirSync(notInstalledDir, { recursive: true });
    writeFileSync(join(notInstalledDir, 'SKILL.md'), '---\nname: not-installed-skill\n---\n');

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr update "${notInstalledDir}"`);
    const output = await tmux.waitForText('No installed skill found', 10_000);
    expect(output).toContain('not-installed-skill');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall dummy-installed -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update local-path finds grouped skill by name', async () => {
    env = createTestEnv();
    await setup();

    const skillDir = join(env.homeDir, 'grouped-source', 'grp-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: grp-skill\ndescription: Grouped skill\n---\nOriginal',
    );

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install "${skillDir}" --group test-group`);
    await tmux.waitForText('Installed', 30_000);
    tmux.destroy();

    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: grp-skill\ndescription: Grouped skill\n---\nUpdated',
    );

    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr update "${skillDir}"`);
    const output = await tmux.waitForText('Done!', 10_000);
    expect(output).toContain('1 updated');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall grp-skill -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });

  it('update local-copy source detects changes', async () => {
    env = createTestEnv();
    await setup();

    const localSkillDir = join(env.homeDir, 'my-local-skill');
    mkdirSync(localSkillDir, { recursive: true });
    writeFileSync(
      join(localSkillDir, 'SKILL.md'),
      '---\nname: my-local-skill\ndescription: A test skill\n---\nOriginal content',
    );

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./my-local-skill');
    await tmux.waitForText('Installed', 30_000);
    tmux.destroy();

    // Update: should be up to date
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update ./my-local-skill');
    const output1 = await tmux.waitForText('Done!', 10_000);
    expect(output1).toContain('up to date');
    tmux.destroy();

    // Modify the original source
    writeFileSync(
      join(localSkillDir, 'SKILL.md'),
      '---\nname: my-local-skill\ndescription: A test skill\n---\nUpdated content',
    );

    // Update: should detect change
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update ./my-local-skill');
    const output2 = await tmux.waitForText('Done!', 10_000);
    expect(output2).toContain('1 updated');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall my-local-skill -f');
    await tmux.waitForText(/Removed|Uninstalled/, 10_000);
  });
});

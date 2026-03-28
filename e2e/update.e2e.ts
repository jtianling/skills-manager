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

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('auto-setup E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('install auto-creates ~/.skills-manager/ on first use', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');
    expect(existsSync(smDir)).toBe(false);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);

    expect(existsSync(join(smDir, 'official'))).toBe(true);
    expect(existsSync(join(smDir, 'community'))).toBe(true);
    expect(existsSync(join(smDir, 'custom'))).toBe(true);
    // No example-skill should be created
    expect(existsSync(join(smDir, 'custom', 'example-skill'))).toBe(false);
  });

  it('list auto-creates ~/.skills-manager/ on first use', async () => {
    env = createTestEnv();
    const smDir = join(env.homeDir, '.skills-manager');
    expect(existsSync(smDir)).toBe(false);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    await tmux.waitForText(/No skills found|Available/, 10_000);

    expect(existsSync(join(smDir, 'official'))).toBe(true);
    expect(existsSync(join(smDir, 'community'))).toBe(true);
    expect(existsSync(join(smDir, 'custom'))).toBe(true);
  });

  it('setup prompt shows deploy instead of init', async () => {
    env = createTestEnv();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText('deploy', 10_000);

    expect(output).toContain('skillsmgr deploy');
    expect(output).not.toContain('skillsmgr init');
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('setup E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('creates directory structure on first run', async () => {
    env = createTestEnv();
    tmux = new TmuxSession(env);

    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');

    const smDir = join(env.homeDir, '.skills-manager');
    expect(existsSync(join(smDir, 'official'))).toBe(true);
    expect(existsSync(join(smDir, 'community'))).toBe(true);
    expect(existsSync(join(smDir, 'custom'))).toBe(true);
    expect(existsSync(join(smDir, 'custom', 'example-skill', 'SKILL.md'))).toBe(true);
  });

  it('is idempotent on second run', async () => {
    env = createTestEnv();
    tmux = new TmuxSession(env);

    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    const output = await tmux.waitForText('Setup complete');

    expect(output).toContain('already exists');
  });
});

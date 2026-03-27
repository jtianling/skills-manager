import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('list E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('list shows installed skills', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');
    const output = await tmux.waitForText('official', 10_000);
    expect(output).toContain('anthropic');
  });
});

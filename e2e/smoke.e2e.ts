import { describe, it, expect, afterEach } from 'vitest';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('E2E framework smoke test', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('can run a command and capture output', async () => {
    env = createTestEnv();
    tmux = new TmuxSession(env);

    await tmux.start('echo "hello e2e test"');
    const output = await tmux.waitForText('hello e2e test');
    expect(output).toContain('hello e2e test');
  });

  it('can run skillsmgr --version', async () => {
    env = createTestEnv();
    tmux = new TmuxSession(env);

    await tmux.start('skillsmgr --version');
    const output = await tmux.waitForText(/\d+\.\d+\.\d+/);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});

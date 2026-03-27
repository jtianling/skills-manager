import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

function stripAnsi(output: string): string {
  return output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

describe('interactive select fold E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  const fixturePath = join(import.meta.dirname, 'fixtures', 'interactive-select-fold.ts');
  const command = `node --experimental-strip-types "${fixturePath}"`;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  async function startFixture(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(command, env.projectDir);
    await tmux.waitForText(/Select skills to install/, 10_000);
    await tmux.waitForText(/repo-a \(2\)/, 10_000);
    await tmux.waitForText(/alpha-one/, 10_000);
  }

  async function captureOutput(): Promise<string> {
    return stripAnsi(await tmux.capturePane());
  }

  it('folds and expands the current group with h and l', async () => {
    await startFixture();

    await tmux.pressKey('h');
    await tmux.waitForText(/repo-a \(2\)/, 5_000);

    let output = await captureOutput();
    expect(output).toContain('▶ ◯ repo-a (2)');
    expect(output).not.toContain('alpha-one');
    expect(output).not.toContain('alpha-two');

    await tmux.pressKey('l');
    await tmux.waitForText(/alpha-one/, 5_000);

    output = await captureOutput();
    expect(output).toContain('▼ ◯ repo-a (2)');
    expect(output).toContain('alpha-one');
    expect(output).toContain('alpha-two');

    await tmux.pressEnter();
    await tmux.waitForText(/RESULT:\[\]/, 5_000);
  });

  it('toggles all groups with c and relocates the cursor to a visible item', async () => {
    await startFixture();

    await tmux.pressKey('Down');
    await tmux.waitForText(/alpha-one/, 5_000);
    await tmux.pressKey('c');

    const output = await captureOutput();
    expect(output).toContain('❯ ▶ ◯ repo-a (2)');
    expect(output).toContain('▶ ◯ repo-b (2)');
    expect(output).not.toContain('alpha-one');
    expect(output).not.toContain('beta-one');

    await tmux.pressEnter();
    await tmux.waitForText(/RESULT:\[\]/, 5_000);
  });

  it('keeps group selection working while the group is collapsed', async () => {
    await startFixture();

    await tmux.pressKey('h');
    await tmux.pressSpace();
    await tmux.pressEnter();

    const output = await tmux.waitForText(/RESULT:/, 5_000);
    expect(stripAnsi(output)).toContain('RESULT:["alpha-one","alpha-two"]');
  });

  it('ignores collapsed state in search mode and restores it after exit', async () => {
    await startFixture();

    await tmux.pressKey('h');
    await tmux.pressKey('/');
    await tmux.sendText('alpha');
    await tmux.waitForText(/alpha-one/, 5_000);

    let output = await captureOutput();
    expect(output).toContain('alpha-one');
    expect(output).not.toContain('fold all');
    expect(output).toContain('esc exit search');

    await tmux.sendKeys('C-[');
    await tmux.waitForText(/fold all/, 5_000);

    output = await captureOutput();
    expect(output).toContain('▶ ◯ repo-a (2)');
    expect(output).not.toContain('alpha-one');

    await tmux.pressEnter();
    await tmux.waitForText(/RESULT:\[\]/, 5_000);
  });
});

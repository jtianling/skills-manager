import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('install E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('install anthropics/skills --all downloads skills from GitHub', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);

    const officialDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic');
    expect(existsSync(officialDir)).toBe(true);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    expect(existsSync(sourcesPath)).toBe(true);
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    expect(Object.keys(sources.sources).some((k: string) => k.includes('anthropic'))).toBe(true);
  });

  it('install anthropics/skills with interactive selection', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills');

    await tmux.waitForText('Select skills to install', 90_000);

    // Wait for UI to render fully
    await new Promise((r) => setTimeout(r, 500));

    // Select first skill and confirm
    await tmux.pressSpace();
    await new Promise((r) => setTimeout(r, 500));
    await tmux.pressEnter();

    await tmux.waitForText('Installed', 110_000);

    const officialDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic');
    expect(existsSync(officialDir)).toBe(true);
  });
});

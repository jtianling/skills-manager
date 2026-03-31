import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
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

  it('packed npm tarball installs and runs setup successfully', () => {
    env = createTestEnv();

    const packageJson = JSON.parse(
      execSync('npm pack --json', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      }),
    ) as Array<{ filename: string }>;
    const tarballName = packageJson[0]?.filename;
    expect(tarballName).toBeTruthy();

    const tarballPath = join(process.cwd(), tarballName);
    const installDir = join(env.homeDir, 'packed-install');
    const execEnv = {
      ...process.env,
      HOME: env.homeDir,
    };

    try {
      mkdirSync(installDir, { recursive: true });
      execSync('npm init -y >/dev/null 2>&1', {
        cwd: installDir,
        env: execEnv,
        stdio: 'inherit',
        shell: '/bin/zsh',
      });
      execSync(`npm install "${tarballPath}" >/dev/null 2>&1`, {
        cwd: installDir,
        env: execEnv,
        stdio: 'inherit',
        shell: '/bin/zsh',
      });

      const output = execSync('./node_modules/.bin/skillsmgr list', {
        cwd: installDir,
        env: execEnv,
        encoding: 'utf-8',
      });

      expect(output).toContain('Setup complete');
      expect(existsSync(join(env.homeDir, '.skills-manager', 'official'))).toBe(true);
      expect(existsSync(join(env.homeDir, '.skills-manager', 'custom'))).toBe(true);
      // No example-skill should be created
      expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'example-skill'))).toBe(false);
    } finally {
      if (existsSync(tarballPath)) {
        rmSync(tarballPath, { force: true });
      }
    }
  });
});

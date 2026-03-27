import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TestEnv {
  homeDir: string;
  projectDir: string;
  cleanup: () => void;
}

export function createTestEnv(): TestEnv {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const baseDir = join(tmpdir(), `skillsmgr-e2e-${id}`);
  const homeDir = join(baseDir, 'home');
  const projectDir = join(baseDir, 'project');

  mkdirSync(homeDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  return {
    homeDir,
    projectDir,
    cleanup: () => {
      rmSync(baseDir, { recursive: true, force: true });
    },
  };
}

function getGhToken(): string | undefined {
  try {
    return execSync('gh auth token 2>/dev/null', { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export class TmuxSession {
  readonly sessionName: string;
  private readonly env: Record<string, string>;

  constructor(testEnv: TestEnv) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.sessionName = `e2e-${id}`;

    const projectRoot = join(import.meta.dirname, '..', '..');
    const distDir = join(projectRoot, 'dist');

    this.env = {
      HOME: testEnv.homeDir,
      PATH: `${distDir}:${process.env.PATH}`,
    };

    const ghToken = process.env.GITHUB_TOKEN ?? getGhToken();
    if (ghToken) {
      this.env.GITHUB_TOKEN = ghToken;
    }
  }

  async start(cmd: string, cwd?: string): Promise<void> {
    const dir = cwd ?? this.env.HOME;

    const wrapperPath = join(tmpdir(), `e2e-wrapper-${this.sessionName}.sh`);
    const exports = Object.entries(this.env)
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n');
    writeFileSync(wrapperPath, `#!/bin/bash\n${exports}\ncd "${dir}"\nexec "$@"\n`);
    chmodSync(wrapperPath, 0o755);

    execSync(
      `tmux new-session -d -s "${this.sessionName}" -x 120 -y 40`,
      { stdio: 'pipe' },
    );

    execSync(
      `tmux set-option -t "${this.sessionName}" remain-on-exit on`,
      { stdio: 'pipe' },
    );

    execSync(
      `tmux send-keys -t "${this.sessionName}" '${wrapperPath} ${cmd.replace(/'/g, "'\\''")}' Enter`,
      { stdio: 'pipe' },
    );

    await sleep(300);
  }

  async sendKeys(keys: string): Promise<void> {
    execSync(`tmux send-keys -t "${this.sessionName}" ${keys}`, {
      stdio: 'pipe',
    });
    await sleep(100);
  }

  async sendText(text: string): Promise<void> {
    execSync(
      `tmux send-keys -t "${this.sessionName}" -l "${text.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' },
    );
    await sleep(100);
  }

  async pressEnter(): Promise<void> {
    await this.sendKeys('Enter');
  }

  async pressSpace(): Promise<void> {
    await this.sendKeys('Space');
  }

  async pressKey(key: string): Promise<void> {
    const keyMap: Record<string, string> = {
      Up: 'Up',
      Down: 'Down',
      Escape: 'Escape',
      j: 'j',
      k: 'k',
      y: 'y',
      n: 'n',
      q: 'q',
    };

    const mapped = keyMap[key] ?? key;
    await this.sendKeys(mapped);
  }

  async capturePane(): Promise<string> {
    const output = execSync(
      `tmux capture-pane -t "${this.sessionName}" -p`,
      { encoding: 'utf-8' },
    );
    return output.replace(/\s+$/, '');
  }

  async waitForText(
    pattern: string | RegExp,
    timeout: number = 30_000,
  ): Promise<string> {
    const start = Date.now();
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    while (Date.now() - start < timeout) {
      try {
        const output = await this.capturePane();
        if (regex.test(output)) {
          return output;
        }
      } catch {
        // Session may have ended
      }
      await sleep(200);
    }

    let lastOutput = '';
    try {
      lastOutput = await this.capturePane();
    } catch {
      lastOutput = '(session ended)';
    }

    throw new Error(
      `Timed out waiting for pattern: ${pattern}\n` +
        `Last captured output:\n${lastOutput}`,
    );
  }

  async waitForExit(timeout: number = 30_000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (!this.isAlive()) {
        return;
      }
      await sleep(200);
    }

    throw new Error('Timed out waiting for session to exit');
  }

  isAlive(): boolean {
    try {
      execSync(`tmux has-session -t "${this.sessionName}" 2>/dev/null`, {
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    try {
      execSync(`tmux kill-session -t "${this.sessionName}" 2>/dev/null`, {
        stdio: 'pipe',
      });
    } catch {
      // Session already gone
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fileExistsInEnv(envHome: string, relativePath: string): boolean {
  return existsSync(join(envHome, relativePath));
}

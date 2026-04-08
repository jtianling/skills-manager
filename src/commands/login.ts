import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { readAuth, writeAuth } from '../services/auth.js';
import { RegistryService } from '../services/registry.js';
import { handlePromptError } from '../utils/prompts.js';
import { REGISTRY_URL } from '../constants.js';

const registryService = new RegistryService();

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

async function pollForToken(sessionId: string): Promise<{ token: string; username: string }> {
  const url = `${REGISTRY_URL}/api/cli-auth/poll?session=${sessionId}`;
  const start = Date.now();

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const res = await fetch(url);
      if (res.status === 404) continue; // session not yet created by browser

      const data = await res.json() as { status: string; token?: string; username?: string };

      switch (data.status) {
        case 'complete':
          return { token: data.token!, username: data.username! };
        case 'pending':
          continue;
        case 'consumed':
          throw new Error('Session already consumed. Please try again.');
        case 'expired':
          throw new Error('Session expired. Please try again.');
        default:
          continue;
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('consumed') || error.message.includes('expired'))) {
        throw error;
      }
      // Network error, keep polling
      continue;
    }
  }

  throw new Error('Login timed out. Please try again.');
}

async function loginWithBrowser(): Promise<void> {
  const sessionId = randomUUID();
  const authUrl = `${REGISTRY_URL}/cli-auth?session=${sessionId}`;

  console.log('Opening browser for login...');
  console.log(`If the browser doesn't open, visit: ${authUrl}\n`);
  openBrowser(authUrl);

  process.stdout.write('Waiting for login...');
  try {
    const result = await pollForToken(sessionId);
    process.stdout.write('\r\x1b[K'); // clear "Waiting" line
    writeAuth({ token: result.token, username: result.username });
    console.log(`Logged in as ${result.username}`);
  } catch (error) {
    process.stdout.write('\r\x1b[K');
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

async function loginWithToken(token: string): Promise<void> {
  try {
    const result = await registryService.whoami(token);
    writeAuth({ token, username: result.username });
    console.log(`Logged in as ${result.username}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

async function loginInteractive(): Promise<void> {
  let username: string;
  let password: string;
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Username:',
        validate: (input: string) => input.length > 0 || 'Username is required',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
        validate: (input: string) => input.length > 0 || 'Password is required',
      },
    ]);
    username = answers.username;
    password = answers.password;
  } catch (error) {
    handlePromptError(error);
  }

  try {
    const result = await registryService.npmLogin(username, password);
    writeAuth({ token: result.token, username });
    console.log(`Logged in as ${username}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export async function executeLogin(options: { token?: string; web?: boolean } = {}): Promise<void> {
  if (options.token) {
    await loginWithToken(options.token);
    return;
  }

  const existing = readAuth();
  if (existing) {
    console.log(`Currently logged in as ${existing.username}.`);
    try {
      const { relogin } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'relogin',
          message: 'Do you want to log in again?',
          default: false,
        },
      ]);
      if (!relogin) {
        return;
      }
    } catch (error) {
      handlePromptError(error);
    }
  }

  if (options.web) {
    await loginWithBrowser();
    return;
  }

  // Default: prompt for login method
  try {
    const { method } = await inquirer.prompt([
      {
        type: 'list',
        name: 'method',
        message: 'How would you like to log in?',
        choices: [
          { name: 'Log in with browser (GitHub, email, etc.)', value: 'browser' },
          { name: 'Log in with username and password', value: 'credentials' },
        ],
      },
    ]);

    if (method === 'browser') {
      await loginWithBrowser();
    } else {
      await loginInteractive();
    }
  } catch (error) {
    handlePromptError(error);
  }
}

export const loginCommand = new Command('login')
  .description('Log in to the skillsmgr.dev registry')
  .option('--token <token>', 'Log in with an API token (for CI/CD)')
  .option('--web', 'Log in via browser directly')
  .action(async (options: { token?: string; web?: boolean }) => {
    await executeLogin(options);
  });

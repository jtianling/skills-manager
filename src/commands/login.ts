import { Command } from 'commander';
import inquirer from 'inquirer';
import { readAuth, writeAuth } from '../services/auth.js';
import { RegistryService } from '../services/registry.js';
import { handlePromptError } from '../utils/prompts.js';

const registryService = new RegistryService();

export async function executeLogin(): Promise<void> {
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

export const loginCommand = new Command('login')
  .description('Log in to the skillsmgr.dev registry')
  .action(async () => {
    await executeLogin();
  });

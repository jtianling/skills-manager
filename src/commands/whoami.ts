import { Command } from 'commander';
import { clearAuth, readAuth } from '../services/auth.js';
import { RegistryService } from '../services/registry.js';

const registryService = new RegistryService();

export async function executeWhoami(): Promise<void> {
  const auth = readAuth();
  if (!auth) {
    console.log('Not logged in. Run "skillsmgr login" to authenticate.');
    return;
  }

  try {
    const { username } = await registryService.whoami(auth.token);
    console.log(`Logged in as ${username}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('expired')) {
      console.error('Token expired. Run "skillsmgr login" to re-authenticate.');
      clearAuth();
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show the currently logged in user')
  .action(async () => {
    await executeWhoami();
  });

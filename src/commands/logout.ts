import { Command } from 'commander';
import { clearAuth, readAuth } from '../services/auth.js';

export async function executeLogout(): Promise<void> {
  const existing = readAuth();
  if (!existing) {
    console.log('Not logged in');
    return;
  }

  clearAuth();
  console.log('Logged out');
}

export const logoutCommand = new Command('logout')
  .description('Log out from the skillsmgr.dev registry')
  .action(async () => {
    await executeLogout();
  });

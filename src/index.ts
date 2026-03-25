import { createRequire } from 'node:module';
import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { syncCommand } from './commands/sync.js';
import { customInstallCommand } from './commands/custom-install.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('skillsmgr')
  .description('Unified skills manager for AI coding tools')
  .version(version);

program.addCommand(setupCommand);
program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(removeCommand);
program.addCommand(syncCommand);
program.addCommand(customInstallCommand);

program.parse();

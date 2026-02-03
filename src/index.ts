import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { syncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('skillsmgr')
  .description('Unified skills manager for AI coding tools')
  .version('0.1.0');

program.addCommand(setupCommand);
program.addCommand(installCommand);
program.addCommand(listCommand);
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(removeCommand);
program.addCommand(syncCommand);

program.parse();

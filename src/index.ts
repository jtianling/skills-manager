import { createRequire } from 'node:module';
import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { deployCommand } from './commands/deploy.js';
import { deploymentsCommand } from './commands/deployments.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { uninstallCommand } from './commands/uninstall.js';
import { groupCommand } from './commands/group.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { publishCommand } from './commands/publish.js';
import { searchCommand } from './commands/search.js';
import { initCommand } from './commands/init.js';
import { migrateCommand } from './commands/migrate.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('skillsmgr')
  .description('Unified skills manager for AI coding tools')
  .version(version);

program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(deployCommand);
program.addCommand(deploymentsCommand);
program.addCommand(addCommand);
program.addCommand(removeCommand);
program.addCommand(uninstallCommand);
program.addCommand(groupCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(publishCommand);
program.addCommand(searchCommand);
program.addCommand(initCommand);
program.addCommand(migrateCommand);

program.parse();

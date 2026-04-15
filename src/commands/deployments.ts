import { Command } from 'commander';
import {
  DeploymentEntryView,
  DeploymentsRegistryService,
} from '../services/deployments-registry.js';
import { promptConfirm } from '../utils/prompts.js';
import { jsonOutput } from '../utils/json-output.js';
import { ensureSetup } from './setup.js';

interface ListOptions {
  json?: boolean;
}

interface PruneOptions {
  y?: boolean;
}

function formatRelative(iso: string): string {
  if (!iso) return 'never';
  const ts = Date.parse(iso);
  if (isNaN(ts)) return iso;
  const diff = Date.now() - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours <= 0) return 'just now';
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

async function executeList(options: ListOptions): Promise<void> {
  await ensureSetup();
  const service = new DeploymentsRegistryService();
  let entries: DeploymentEntryView[];
  try {
    entries = service.list();
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  if (options.json) {
    jsonOutput({ deployments: entries });
    return;
  }

  if (entries.length === 0) {
    console.log('No deployments registered.  Run `skillsmgr deploy` in a project to register one.');
    return;
  }

  for (const entry of entries) {
    const missing = entry.exists ? '' : ' (missing)';
    console.log(`${entry.path}${missing}`);
    console.log(`  mode: ${entry.mode}`);
    console.log(`  follow: ${entry.followGroups.length > 0 ? entry.followGroups.join(', ') : '-'}`);
    console.log(`  pinned: ${entry.pinnedSkills.length} skill${entry.pinnedSkills.length === 1 ? '' : 's'}`);
    console.log(`  last deployed: ${formatRelative(entry.lastDeployedAt)}`);
  }
}

async function executePrune(options: PruneOptions): Promise<void> {
  await ensureSetup();
  const service = new DeploymentsRegistryService();
  let entries: DeploymentEntryView[];
  try {
    entries = service.list();
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  const stale = entries.filter((entry) => !entry.exists);
  if (stale.length === 0) {
    console.log('No stale entries found.');
    return;
  }

  console.log('Stale entries (path missing):');
  for (const entry of stale) {
    console.log(`  - ${entry.path}`);
  }

  if (!options.y) {
    const ok = await promptConfirm(`Remove ${stale.length} stale entries?`, false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const removed = service.pruneStale();
  console.log(`Removed ${removed.length} stale entr${removed.length === 1 ? 'y' : 'ies'}.`);
}

async function executeRemove(path: string): Promise<void> {
  await ensureSetup();
  const service = new DeploymentsRegistryService();
  try {
    service.remove(path);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`Removed ${path} from registry.`);
}

export const deploymentsCommand = new Command('deployments')
  .description('Manage the global deployments registry')
  .action(async () => {
    await executeList({});
  });

deploymentsCommand
  .command('list')
  .description('List all registered project deployments')
  .option('--json', 'Output as JSON')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

deploymentsCommand
  .command('prune')
  .description('Remove registry entries for projects whose path no longer exists')
  .option('-y', 'Skip confirmation prompt')
  .action(async (options: PruneOptions) => {
    await executePrune(options);
  });

deploymentsCommand
  .command('remove')
  .argument('<path>', 'Project path to remove from registry')
  .description('Remove a specific project from the registry')
  .action(async (path: string) => {
    await executeRemove(path);
  });

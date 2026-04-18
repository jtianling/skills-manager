import { Command } from 'commander';
import { existsSync, readdirSync, renameSync, rmdirSync } from 'fs';
import { join } from 'path';
import { DeploymentsRegistryService } from '../services/deployments-registry.js';
import { ensureSetup } from './setup.js';

const OLD_DIR = '.skills-manager';
const OLD_FILE = 'deployment.json';
const NEW_FILE = 'skillsmgr-deploy.json';

type Outcome = 'migrated' | 'no-old' | 'new-exists' | 'missing-project' | 'error';

interface Result {
  path: string;
  outcome: Outcome;
  detail?: string;
}

function migrateOne(projectPath: string): Result {
  if (!existsSync(projectPath)) {
    return { path: projectPath, outcome: 'missing-project' };
  }
  const oldPath = join(projectPath, OLD_DIR, OLD_FILE);
  const newPath = join(projectPath, NEW_FILE);
  if (!existsSync(oldPath)) {
    return { path: projectPath, outcome: 'no-old' };
  }
  if (existsSync(newPath)) {
    return { path: projectPath, outcome: 'new-exists' };
  }
  try {
    renameSync(oldPath, newPath);
    const oldDir = join(projectPath, OLD_DIR);
    try {
      if (readdirSync(oldDir).length === 0) {
        rmdirSync(oldDir);
      }
    } catch {
      // leave the old dir if it has other stuff or cannot be removed
    }
    return { path: projectPath, outcome: 'migrated' };
  } catch (e) {
    return { path: projectPath, outcome: 'error', detail: (e as Error).message };
  }
}

export async function executeMigrate(): Promise<void> {
  await ensureSetup();
  const registry = new DeploymentsRegistryService();
  const paths = new Set<string>();
  for (const entry of registry.list()) {
    paths.add(entry.path);
  }
  paths.add(process.cwd());

  const results: Result[] = [];
  for (const p of paths) {
    results.push(migrateOne(p));
  }

  const migrated = results.filter((r) => r.outcome === 'migrated');
  const newExists = results.filter((r) => r.outcome === 'new-exists');
  const missingProject = results.filter((r) => r.outcome === 'missing-project');
  const errors = results.filter((r) => r.outcome === 'error');

  console.log(
    `Migrating deployment manifests: ${OLD_DIR}/${OLD_FILE} → ${NEW_FILE}\n`,
  );
  for (const r of migrated) {
    console.log(`✓ ${r.path}`);
  }
  for (const r of newExists) {
    console.log(`- ${r.path}: skipped (${NEW_FILE} already exists)`);
  }
  for (const r of missingProject) {
    console.log(`- ${r.path}: skipped (project path missing)`);
  }
  for (const r of errors) {
    console.log(`! ${r.path}: ${r.detail}`);
  }

  const summary = [
    `${migrated.length} migrated`,
    `${newExists.length + missingProject.length} skipped`,
    `${errors.length} error${errors.length === 1 ? '' : 's'}`,
  ].join(', ');
  console.log(`\n${summary}`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

export const migrateCommand = new Command('migrate')
  .description(
    `Move legacy ${OLD_DIR}/${OLD_FILE} to project root ${NEW_FILE} for all registered projects`,
  )
  .action(async () => {
    await executeMigrate();
  });

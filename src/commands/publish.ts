import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Command } from 'commander';
import { getToken } from '../services/auth.js';
import { readManifest } from '../services/manifest.js';
import { RegistryService } from '../services/registry.js';
import { parseDependencyIdentifier, type ParsedDependency } from '../services/dependency.js';
import { removeDir } from '../utils/fs.js';
import { promptSelect } from '../utils/prompts.js';
import type { SkillManifest } from '../types.js';

const registryService = new RegistryService();

function createTarball(dir: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-publish-'));
  const tarballPath = join(tempDir, 'package.tgz');

  try {
    execFileSync('tar', [
      'czf', tarballPath,
      '--exclude', 'node_modules',
      '--exclude', '.git',
      '--exclude', '.DS_Store',
      '-C', dir,
      '.',
    ]);

    const buffer = readFileSync(tarballPath);
    return buffer.toString('base64');
  } finally {
    removeDir(tempDir);
  }
}

export interface UnavailableDep {
  identifier: string;
  parsed: ParsedDependency;
}

export async function checkDependencyAvailability(
  dependencies: string[],
): Promise<UnavailableDep[]> {
  const unavailable: UnavailableDep[] = [];

  for (const dep of dependencies) {
    const parsed = parseDependencyIdentifier(dep);

    if (parsed.type === 'registry') {
      try {
        await registryService.getPackument(parsed.packageName);
      } catch (error) {
        // Only treat "not found" as unavailable; rethrow network/server errors
        if (error instanceof Error && error.message.includes('not found')) {
          unavailable.push({ identifier: dep, parsed });
        } else {
          throw error;
        }
      }
    } else {
      // GitHub dependencies are not on registry by definition
      unavailable.push({ identifier: dep, parsed });
    }
  }

  return unavailable;
}

type CascadeAction = 'publish-together' | 'skip' | 'cancel';

export async function handleUnavailableDeps(
  unavailableDeps: UnavailableDep[],
  manifest: SkillManifest,
  token: string,
): Promise<{ proceed: boolean; updatedDependencies: string[] }> {
  const updatedDeps = [...(manifest.dependencies ?? [])];

  for (const { identifier, parsed } of unavailableDeps) {
    console.log(`\n⚠ Dependency "${identifier}" is not available on registry.`);

    const action = await promptSelect<CascadeAction>(
      `How to handle "${identifier}"?`,
      [
        { name: 'Publish together (cascade publish)', value: 'publish-together' },
        { name: 'Skip (remove from dependencies)', value: 'skip' },
        { name: 'Cancel publishing', value: 'cancel' },
      ],
    );

    switch (action) {
      case 'cancel':
        return { proceed: false, updatedDependencies: updatedDeps };

      case 'skip': {
        const idx = updatedDeps.indexOf(identifier);
        if (idx !== -1) updatedDeps.splice(idx, 1);
        console.log(`Removed "${identifier}" from dependencies.`);
        break;
      }

      case 'publish-together': {
        const publishedName = await cascadePublishDep(parsed, token);
        if (publishedName) {
          // Replace non-registry identifiers with registry package name
          const idx = updatedDeps.indexOf(identifier);
          if (idx !== -1 && parsed.type !== 'registry') {
            updatedDeps[idx] = publishedName;
            console.log(`Updated dependency "${identifier}" → "${publishedName}"`);
          }
        } else {
          console.error(`Cannot cascade publish "${identifier}". Please publish it manually first, then retry.`);
          return { proceed: false, updatedDependencies: updatedDeps };
        }
        break;
      }
    }
  }

  return { proceed: true, updatedDependencies: updatedDeps };
}

async function cascadePublishDep(
  parsed: ParsedDependency,
  token: string,
): Promise<string | null> {
  if (parsed.type === 'registry') {
    console.log(`Cannot cascade publish registry package "${parsed.packageName}" — it must be published separately.`);
    return null;
  }

  // For GitHub dependencies, we need user to provide a local path for now
  const depDesc = parsed.type === 'github-skill'
    ? `${parsed.owner}/${parsed.repo}:${parsed.skillName}`
    : `${parsed.owner}/${parsed.repo}`;

  console.log(`\nTo cascade publish "${depDesc}", the skill must be available locally.`);
  console.log(`Please publish it manually first: skillsmgr publish <path-to-skill>`);
  return null;
}

export async function executePublish(dir: string): Promise<void> {
  const token = getToken();
  if (!token) {
    console.error('Not logged in. Run "skillsmgr login" first.');
    process.exit(1);
  }

  const manifest = readManifest(dir);
  if (!manifest) {
    console.error('No skill.json found. Run "skillsmgr init" to create one.');
    process.exit(1);
  }

  // Check dependency availability
  if (!manifest.dependencies || manifest.dependencies.length === 0) {
    console.log('No dependencies declared.');
  } else if (manifest.dependencies.length > 0) {
    console.log('Checking dependency availability...');
    const unavailable = await checkDependencyAvailability(manifest.dependencies);

    if (unavailable.length > 0) {
      console.log(`\n${unavailable.length} dependencies not available on registry:`);
      for (const { identifier } of unavailable) {
        console.log(`  - ${identifier}`);
      }

      const { proceed, updatedDependencies } = await handleUnavailableDeps(
        unavailable,
        manifest,
        token,
      );

      if (!proceed) {
        console.log('Publishing cancelled.');
        return;
      }

      // Update manifest with resolved dependencies for publishing
      manifest.dependencies = updatedDependencies;
    } else {
      console.log('All dependencies available on registry. ✓');
    }
  }

  console.log(`Publishing ${manifest.name}@${manifest.version}...`);

  try {
    const tarball = createTarball(dir);

    await registryService.publish(manifest.name, {
      version: manifest.version,
      description: manifest.description,
      manifest,
      tarball,
    }, token);

    console.log(`Published ${manifest.name}@${manifest.version}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export const publishCommand = new Command('publish')
  .description('Publish a skill to the skillsmgr.dev registry')
  .argument('[dir]', 'Directory to publish', '.')
  .action(async (dir: string) => {
    await executePublish(dir);
  });

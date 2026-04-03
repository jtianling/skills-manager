import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Command } from 'commander';
import { getToken } from '../services/auth.js';
import { readManifest } from '../services/manifest.js';
import { RegistryService } from '../services/registry.js';
import { removeDir } from '../utils/fs.js';

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

export async function executePublish(dir: string): Promise<void> {
  const token = getToken();
  if (!token) {
    console.error('Not logged in. Run "skillsmgr login" first.');
    process.exit(1);
  }

  const manifest = readManifest(dir);
  if (!manifest) {
    console.error('No skill.json found. Create one manually or run "skillsmgr init-manifest".');
    process.exit(1);
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

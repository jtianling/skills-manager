import { Command } from 'commander';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { type InstallOptions, collect } from '../types.js';
import { ensureSetup } from './setup.js';
import { detectSourceType, parseRegistryInput } from '../utils/source-detection.js';
import { installViaGitClone } from './install-git.js';
import { installFromLocalDir, installFromRemoteZip, installFromZip } from './install-local.js';
import { installFromRegistry } from './install-registry.js';
import type { InstallResult } from './install-utils.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';

async function installBySourceType(source: string, options: InstallOptions): Promise<InstallResult> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'remote-zip':
      return installFromRemoteZip(source, options);
    case 'local-zip':
      return installFromZip(source, options);
    case 'owner-repo': {
      const normalizedSource = source.replace(/\/$/, '');
      return installViaGitClone(`https://github.com/${normalizedSource}`, options);
    }
    case 'remote-url':
      return installViaGitClone(source, options);
    case 'local-path':
      return installFromLocalDir(source, options);
    case 'registry': {
      const detected = parseRegistryInput(source);
      if (!detected) {
        throw new Error(`Invalid registry package name: '${source}'`);
      }
      return installFromRegistry(detected, options);
    }
    case 'unknown':
      throw new Error(
        `Unknown source format '${source}'. Use ./name for local, owner/repo for GitHub.`
      );
    default: {
      const _exhaustive: never = sourceType;
      return _exhaustive;
    }
  }
}

export async function installSource(source: string, options: InstallOptions = {}): Promise<InstallResult> {
  return installBySourceType(source, { all: true, ...options });
}

export async function executeInstall(source: string, options: InstallOptions): Promise<void> {
  // In json mode, redirect console.log to stderr so only JSON goes to stdout
  const origLog = console.log;
  if (options.json) {
    console.log = (...args: unknown[]) => console.error(...args);
  }

  await ensureSetup();

  if (options.group) {
    try {
      validateGroupName(options.group);
    } catch (e) {
      if (options.json) {
        console.log = origLog;
        jsonError((e as Error).message, 'INVALID_GROUP');
      } else {
        console.error(`Error: ${(e as Error).message}`);
      }
      process.exit(1);
    }
  }

  try {
    const result = await installBySourceType(source, options);

    const groupName = options.group ?? result.batchGroupName;
    if (groupName && result.sourceKeys && result.sourceKeys.length > 0) {
      const groupsService = new GroupsService();
      for (const key of result.sourceKeys) {
        groupsService.addSkill(groupName, key);
      }
    }

    if (options.json) {
      console.log = origLog;
      jsonOutput({
        installed: {
          source,
          basePath: result.basePath,
          skills: result.sourceKeys ?? [],
          group: groupName ?? null,
        },
      });
    }
  } catch (error) {
    if (options.json) {
      console.log = origLog;
      jsonError(error instanceof Error ? error.message : 'Unknown error', 'INSTALL_ERROR');
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export { InstallResult };

export const installCommand = new Command('install')
  .alias('i')
  .description('Install skills from a local path, zip archive, repository, URL, or registry')
  .argument('<source>', 'Local path, zip file, owner/repo, URL, or package name')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .option('--group <name>', 'Add installed skills to a virtual group')
  .option('-s, --skill <name>', 'Specific skill to install (repeatable)', collect, [])
  .option('--json', 'Output as JSON (logs to stderr)')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

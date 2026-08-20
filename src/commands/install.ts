import { Command } from 'commander';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { type InstallOptions, collect } from '../types.js';
import { SourcesService } from '../services/sources.js';
import { ensureSetup } from './setup.js';
import {
  detectSourceType,
  normalizeCollectionRef,
  parseOwnerRepoSkill,
  parseRegistryInput,
} from '../utils/source-detection.js';
import { installViaGitClone } from './install-git.js';
import { installFromLocalDir, installFromRemoteZip, installFromZip } from './install-local.js';
import { installFromRegistry } from './install-registry.js';
import { installFromWellKnown } from './install-wellknown.js';
import type { InstallResult } from './install-utils.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';
import { executeInstallFromCollection } from './install-collection.js';

const sourcesService = new SourcesService();

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
    case 'owner-repo-skill': {
      const parsed = parseOwnerRepoSkill(source);
      if (!parsed) {
        throw new Error(`Invalid owner/repo:skill input: '${source}'`);
      }
      return installViaGitClone(`https://github.com/${parsed.owner}/${parsed.repo}`, {
        ...options,
        skill: [parsed.skillName],
      });
    }
    case 'remote-url':
      return installViaGitClone(source, options);
    case 'well-known':
      return installFromWellKnown(source, options);
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
        `Unknown source format "${source}". Use ./name for local, owner/repo for GitHub.`
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

export async function executeInstall(source: string | undefined, options: InstallOptions): Promise<void> {
  if (options.from) {
    await executeInstallFromCollection(options.from, options);
    return;
  }

  if (!source) {
    console.error('Error: source is required (or use --from <collection>)');
    process.exit(1);
  }

  if (options.y) {
    if (!options.all) options.all = true;
  }

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

    const groupsService = new GroupsService();
    if (groupsService.getGroupKind(options.group) === 'local-batch') {
      const message = `Cannot add to physical group '${options.group}'. Members of physical groups are derived from custom/${options.group}/.  Use a virtual group name instead.`;
      if (options.json) {
        console.log = origLog;
        jsonError(message, 'INVALID_GROUP');
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }
  }

  try {
    const result = await installBySourceType(source, options);

    if (result.bundleInfo) {
      sourcesService.addBundle(result.bundleInfo.id, result.bundleInfo.info);
    }

    const groupName = options.group;
    const skillKeys = result.skillKeys ?? [];
    if (groupName && (result.installedPaths?.length ?? 0) > 0) {
      if (skillKeys.length === 0) {
        throw new Error(
          `Cannot add to group '${groupName}': the install produced no skill keys.`,
        );
      }
      const groupsService = new GroupsService();
      for (const key of skillKeys) {
        groupsService.addSkill(groupName, key);
      }
    }

    if (options.json) {
      console.log = origLog;
      jsonOutput({
        installed: {
          source,
          basePath: result.basePath,
          skills: skillKeys,
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
  .description('Install skills from a local path, zip archive, repository, URL, registry, or collection')
  .argument('[source]', 'Local path, zip file, owner/repo, URL, or package name')
  .option('--all', 'Install all skills without prompting')
  .option('-y', 'Skip all prompts (implies --all)')
  .option('--custom', 'Install to custom/ instead of community/')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .option('--group <name>', 'Add installed skills to a virtual group')
  .option('-s, --skill <name>', 'Specific skill to install (repeatable)', collect, [])
  .option('--from <ref>', 'Install all skills from a collection (e.g. @alice/kit)')
  .option('--json', 'Output as JSON (logs to stderr)')
  .action(async (source: string | undefined, options: InstallOptions) => {
    await executeInstall(source, options);
  });

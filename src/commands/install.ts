import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { type InstallOptions, collect } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { detectSourceType } from '../utils/source-detection.js';
import { installViaGitClone } from './install-git.js';
import { installFromLocalDir, installFromRemoteZip, installFromZip } from './install-local.js';
import type { InstallResult } from './install-utils.js';

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
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  if (options.group) {
    try {
      validateGroupName(options.group);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
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
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export { InstallResult };

export const installCommand = new Command('install')
  .alias('i')
  .description('Install skills from a local path, zip archive, repository, or URL')
  .argument('<source>', 'Local path, zip file, owner/repo, or URL')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .option('--group <name>', 'Add installed skills to a virtual group')
  .option('-s, --skill <name>', 'Specific skill to install (repeatable)', collect, [])
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

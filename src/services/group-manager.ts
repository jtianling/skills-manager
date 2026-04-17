import { renameSync } from 'fs';
import { basename, join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import type { InstallOptions } from '../types.js';
import { promptConfirm } from '../utils/prompts.js';
import { fileExists, getDirectoriesInDir, readFileContent, removeDir } from '../utils/fs.js';
import { GitHubService } from './github.js';
import {
  formatBatchConflictList,
  formatReinstallConflictMessage,
} from './group-conflict-messages.js';
import { GroupsService, validateGroupName } from './groups.js';
import { RegistryService } from './registry.js';
import { SourceInfo, SourcesService } from './sources.js';
import { SourceUpdater, UpdateResult } from './source-updater.js';
import {
  createInstallResult,
  findCustomSkillByKey,
  getCustomSkillDir,
  getCustomSkillKey,
  getLocalOverwriteMessage,
  installSingleSkillToLocalTarget,
  prepareTargetDir,
  scanSkillDirectories,
  selectSkills,
  type InstallResult,
} from '../commands/install-utils.js';

export interface GroupInstallResult extends InstallResult {
  groupName: string;
}

export interface PhysicalGroupUninstallOptions {
  force?: boolean;
}

export interface PhysicalGroupUninstallResult {
  groupName: string;
  removed: number;
  affectedKeys: string[];
}

export interface PhysicalGroupUpdateOptions {
  keepLocal?: boolean;
  verbose?: boolean;
}

export interface PhysicalGroupUpdateResult {
  groupName: string;
  updated: number;
  upToDate: number;
  added: number;
  removed: number;
  kept: number;
  failed: number;
  skipped: number;
  members: string[];
}

export interface VirtualGroupUpdateResult extends UpdateResult {
  groupName: string;
}

function scanSkillSubdirs(dir: string): string[] {
  return getDirectoriesInDir(dir)
    .filter((entry) => fileExists(join(entry.path, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function printUninstallWarning(): void {
  console.log('\nWarning: Symlinked deployments in projects will break.');
  console.log('Use `skillsmgr remove <name>` in affected projects first.\n');
}

export class GroupManager {
  private readonly sourceUpdater: SourceUpdater;

  constructor(
    private readonly sourcesService: SourcesService = new SourcesService(),
    private readonly groupsService: GroupsService = new GroupsService(),
    private readonly githubService: GitHubService = new GitHubService(),
    private readonly registryService: RegistryService = new RegistryService(),
  ) {
    this.sourceUpdater = new SourceUpdater(
      this.sourcesService,
      this.githubService,
      this.registryService,
      this.groupsService,
    );
  }

  async installLocalBatch(
    absolutePath: string,
    options: InstallOptions,
  ): Promise<GroupInstallResult> {
    const groupName = basename(absolutePath);
    validateGroupName(groupName);
    const existingGroup = this.groupsService.getGroup(groupName);
    const physicalCandidates = this.groupsService
      .findPhysicalGroupsByBasename(groupName)
      .map(({ name, group }) => ({
        name,
        url: group.url,
      }));

    if (physicalCandidates.length > 1) {
      throw new Error(formatBatchConflictList(groupName, physicalCandidates));
    }

    if (existingGroup?.kind === 'local-batch' && existingGroup.url !== absolutePath) {
      throw new Error(
        formatReinstallConflictMessage(
          'A local-batch group',
          groupName,
          existingGroup.url,
          absolutePath,
        ),
      );
    }

    if (existingGroup?.kind === 'virtual') {
      throw new Error(
        `A virtual group '${groupName}' already exists. Physical and virtual groups must not share a name. ` +
        `Run: skillsmgr group rename ${groupName} <new-name> first, or use a different directory name.`,
      );
    }

    if (
      physicalCandidates.length === 1 &&
      physicalCandidates[0].name !== groupName &&
      physicalCandidates[0].url !== absolutePath
    ) {
      throw new Error(formatBatchConflictList(groupName, physicalCandidates));
    }

    const scannedSkills = scanSkillDirectories(absolutePath, 1);
    if (scannedSkills.length === 0) {
      throw new Error(`No skills found in ${absolutePath}`);
    }

    const installedNames = new Set<string>();
    for (const skill of scannedSkills) {
      if (fileExists(getCustomSkillDir(skill.name, groupName))) {
        installedNames.add(skill.name);
      }
    }

    const { skills: selectedSkills } = await selectSkills(scannedSkills, options, installedNames);
    if (selectedSkills.length === 0) {
      return {
        ...createInstallResult([], []),
        groupName,
      };
    }

    const installedPaths: string[] = [];
    const sourceKeys: string[] = [];

    for (const skill of selectedSkills) {
      const targetDir = getCustomSkillDir(skill.name, groupName);
      const sourceKey = getCustomSkillKey(skill.name, groupName);
      const ready = await prepareTargetDir(
        targetDir,
        getLocalOverwriteMessage(skill.name),
        options.force,
      );
      if (!ready) {
        break;
      }

      installSingleSkillToLocalTarget(skill.path, targetDir);
      this.sourcesService.addSource(sourceKey, {
        url: absolutePath,
        type: 'custom',
        repoName: skill.name,
        installMethod: 'local-copy',
      });

      installedPaths.push(targetDir);
      sourceKeys.push(sourceKey);
    }

    if (installedPaths.length > 0) {
      if (existingGroup?.kind === 'local-batch') {
        this.groupsService.updatePhysicalGroupTimestamp(groupName);
      } else {
        this.groupsService.createLocalBatchGroup(groupName, absolutePath);
      }

      console.log(
        `✓ Installed ${installedPaths.length} skill${installedPaths.length === 1 ? '' : 's'} from ${groupName}`,
      );
    }

    return {
      ...createInstallResult(installedPaths, sourceKeys),
      groupName,
    };
  }

  async uninstallPhysicalGroup(
    name: string,
    options: PhysicalGroupUninstallOptions = {},
  ): Promise<PhysicalGroupUninstallResult> {
    const group = this.groupsService.getGroup(name);
    if (!group || group.kind !== 'local-batch') {
      throw new Error(`Group '${name}' is not a local-batch group.`);
    }

    const physicalKeys = new Set(this.groupsService.getGroupMembers(name));
    const recordedKeys = Object.keys(this.sourcesService.getAllSources())
      .filter((key) => key.startsWith(`custom/${name}/`));
    const affectedKeys = [...new Set([...physicalKeys, ...recordedKeys])].sort((a, b) =>
      a.localeCompare(b),
    );

    console.log('\nSkills to uninstall:');
    for (const key of affectedKeys) {
      console.log(`  - ${key}`);
    }
    printUninstallWarning();

    if (!options.force) {
      const confirmed = await promptConfirm('Confirm uninstall?', false);
      if (!confirmed) {
        console.log('Cancelled.');
        return {
          groupName: name,
          removed: 0,
          affectedKeys,
        };
      }
    }

    removeDir(join(SKILLS_MANAGER_DIR, 'custom', name));
    for (const key of affectedKeys) {
      this.sourcesService.removeSource(key);
      this.groupsService.removeSkillFromAll(key);
    }
    this.groupsService.deletePhysicalGroup(name);

    return {
      groupName: name,
      removed: affectedKeys.length,
      affectedKeys,
    };
  }

  async updatePhysicalGroup(
    name: string,
    options: PhysicalGroupUpdateOptions = {},
  ): Promise<PhysicalGroupUpdateResult> {
    const group = this.groupsService.getGroup(name);
    if (!group || group.kind !== 'local-batch') {
      throw new Error(`Group '${name}' is not a local-batch group.`);
    }

    if (!fileExists(group.url)) {
      throw new Error(
        `Source path no longer exists for physical group '${name}'. ` +
        'Run update with the new path to rebind first.',
      );
    }

    const targetDir = join(SKILLS_MANAGER_DIR, 'custom', name);
    const sourceSkills = scanSkillSubdirs(group.url);
    const targetSkills = scanSkillSubdirs(targetDir);
    const sourceSet = new Set(sourceSkills);
    const targetSet = new Set(targetSkills);
    const existing = sourceSkills.filter((skill) => targetSet.has(skill));
    const added = sourceSkills.filter((skill) => !targetSet.has(skill));
    const orphaned = targetSkills.filter((skill) => !sourceSet.has(skill));
    const result: PhysicalGroupUpdateResult = {
      groupName: name,
      updated: 0,
      upToDate: 0,
      added: 0,
      removed: 0,
      kept: 0,
      failed: 0,
      skipped: 0,
      members: [],
    };

    for (const skillName of existing) {
      try {
        const sourceDir = join(group.url, skillName);
        const targetSkillDir = join(targetDir, skillName);
        const sourceSkillMd = join(sourceDir, 'SKILL.md');
        const targetSkillMd = join(targetSkillDir, 'SKILL.md');
        const changed = !fileExists(sourceSkillMd) ||
          !fileExists(targetSkillMd) ||
          readFileContent(sourceSkillMd) !== readFileContent(targetSkillMd);

        if (changed) {
          removeDir(targetSkillDir);
          installSingleSkillToLocalTarget(sourceDir, targetSkillDir);
          this.sourcesService.addSource(getCustomSkillKey(skillName, name), {
            url: group.url,
            type: 'custom',
            repoName: skillName,
            installMethod: 'local-copy',
          });
          result.updated++;
          console.log(`  ↑ ${skillName}: updated`);
        } else {
          result.upToDate++;
          if (options.verbose) {
            console.log(`  ✓ ${skillName}: up to date`);
          }
        }
      } catch {
        result.failed++;
        console.log(`  ✗ ${skillName}: failed to update`);
      }
    }

    for (const skillName of added) {
      try {
        const sourceDir = join(group.url, skillName);
        const targetSkillDir = join(targetDir, skillName);
        removeDir(targetSkillDir);
        installSingleSkillToLocalTarget(sourceDir, targetSkillDir);
        this.sourcesService.addSource(getCustomSkillKey(skillName, name), {
          url: group.url,
          type: 'custom',
          repoName: skillName,
          installMethod: 'local-copy',
        });
        result.added++;
        console.log(`  + ${skillName}: installed`);
      } catch {
        result.failed++;
        console.log(`  ✗ ${skillName}: failed to install`);
      }
    }

    for (const skillName of orphaned) {
      const sourceKey = getCustomSkillKey(skillName, name);
      if (options.keepLocal) {
        result.kept++;
        console.log(`  - ${skillName} (kept locally)`);
        continue;
      }

      try {
        removeDir(join(targetDir, skillName));
        this.sourcesService.removeSource(sourceKey);
        this.groupsService.removeSkillFromAll(sourceKey);
        result.removed++;
        console.log(`  - ${skillName}: removed`);
      } catch {
        result.failed++;
        console.log(`  ✗ ${skillName}: failed to remove`);
      }
    }

    if (!options.verbose && result.upToDate > 0) {
      console.log(`  ✓ ${result.upToDate} skills up to date`);
    }

    this.groupsService.updatePhysicalGroupTimestamp(name);
    result.members = this.groupsService.getGroupMembers(name);
    return result;
  }

  async updateVirtualGroup(name: string): Promise<VirtualGroupUpdateResult> {
    const group = this.groupsService.getGroup(name);
    if (!group || group.kind !== 'virtual') {
      throw new Error(`Group '${name}' is not a virtual group.`);
    }

    const grouped = new Map<string, { info: SourceInfo; selectedSkillNames?: Set<string> }>();
    const result: VirtualGroupUpdateResult = {
      groupName: name,
      updated: 0,
      upToDate: 0,
      failed: 0,
      skipped: 0,
    };

    for (const member of group.members) {
      const direct = this.sourcesService.getSource(member);
      if (direct) {
        grouped.set(member, { info: direct });
        continue;
      }

      if (member.split('/').length === 2 && findCustomSkillByKey(member)) {
        console.log(`  ⚠ ${member}: local skill, run \`skillsmgr update ./path\` to update`);
        result.skipped++;
        continue;
      }

      const parts = member.split('/');
      if (parts.length < 2) {
        console.log(`  ⚠ ${member}: dangling reference, skipped`);
        result.skipped++;
        continue;
      }

      const sourceKey = parts.slice(0, -1).join('/');
      const info = this.sourcesService.getSource(sourceKey);
      if (!info) {
        console.log(`  ⚠ ${member}: dangling reference, skipped`);
        result.skipped++;
        continue;
      }

      const skillName = parts[parts.length - 1];
      const existing = grouped.get(sourceKey);
      const selectedSkillNames = new Set(existing?.selectedSkillNames ?? []);
      selectedSkillNames.add(skillName);
      grouped.set(sourceKey, { info, selectedSkillNames });
    }

    for (const [sourceKey, request] of grouped.entries()) {
      console.log(`Updating ${sourceKey}...\n`);
      const sourceResult = await this.sourceUpdater.updateSource(sourceKey, request.info, {
        selectedSkillNames: request.selectedSkillNames,
      });
      result.updated += sourceResult.updated;
      result.upToDate += sourceResult.upToDate;
      result.failed += sourceResult.failed;
      result.skipped += sourceResult.skipped;
    }

    return result;
  }

  renamePhysicalGroup(oldName: string, newName: string): void {
    validateGroupName(newName);
    const group = this.groupsService.getGroup(oldName);
    if (!group || group.kind !== 'local-batch') {
      throw new Error(`Group '${oldName}' is not a local-batch group.`);
    }
    if (oldName === newName) {
      throw new Error('New name is the same as the current name.');
    }
    if (this.groupsService.getGroup(newName)) {
      throw new Error(`Group '${newName}' already exists.`);
    }

    const oldDir = join(SKILLS_MANAGER_DIR, 'custom', oldName);
    const newDir = join(SKILLS_MANAGER_DIR, 'custom', newName);
    if (fileExists(newDir)) {
      throw new Error(`custom/${newName} already exists.`);
    }
    if (fileExists(oldDir)) {
      renameSync(oldDir, newDir);
    }

    this.sourcesService.renameCustomGroupSources(oldName, newName);
    this.groupsService.renameVirtualGroupMemberPrefix(
      `custom/${oldName}/`,
      `custom/${newName}/`,
    );
    this.groupsService.renamePhysicalGroupEntry(oldName, newName);
  }

  rebindPhysicalGroup(name: string, newUrl: string): void {
    this.groupsService.setPhysicalGroupSourceUrl(name, newUrl);
    this.sourcesService.rebindPhysicalGroupSources(name, newUrl);
  }
}

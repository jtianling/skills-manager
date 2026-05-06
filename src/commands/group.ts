import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GroupManager } from '../services/group-manager.js';
import { GroupsService, isCollectionGroupKey, validateGroupName } from '../services/groups.js';
import { SkillsService } from '../services/skills.js';
import { collect, type InstallOptions, type SkillInfo } from '../types.js';
import {
  getSourceSuffix,
  promptGroupAddConflictResolution,
  promptSelect,
} from '../utils/prompts.js';
import { detectArgFormat, findRepoInCentralRepository } from '../utils/repo-lookup.js';
import { resolveLocalSourcePath } from './install-local.js';
import { ensureSetup } from './setup.js';

type GroupAddCandidate =
  | {
    type: 'skill';
    skill: SkillInfo;
  }
  | {
    type: 'group';
    name: string;
    skillKeys: string[];
  }
  | {
    type: 'repo';
    ownerRepo: string;
    skills: SkillInfo[];
  };

type AddSkillResult =
  | { status: 'added'; skillKey: string }
  | { status: 'already-present'; skillKey: string }
  | { status: 'replaced'; skillKey: string; conflictKey: string }
  | { status: 'skipped'; skillKey: string; conflictKey: string };

type RemoveSkillResult =
  | { status: 'removed'; skillKey: string }
  | { status: 'not-present'; skillKey: string };

function skillKeyOf(skill: SkillInfo): string {
  return `${skill.source}/${skill.name}`;
}

function skillNameFromKey(skillKey: string): string {
  const parts = skillKey.split('/');
  return parts[parts.length - 1] ?? skillKey;
}

function candidateValue(candidate: GroupAddCandidate): string {
  if (candidate.type === 'skill') {
    return `skill:${skillKeyOf(candidate.skill)}`;
  }

  if (candidate.type === 'group') {
    return `group:${candidate.name}`;
  }

  return `repo:${candidate.ownerRepo}`;
}

function candidateLabel(candidate: GroupAddCandidate): string {
  if (candidate.type === 'skill') {
    const key = skillKeyOf(candidate.skill);
    return `skill: ${candidate.skill.name} (${key})`;
  }

  if (candidate.type === 'group') {
    return `group: ${candidate.name} (${candidate.skillKeys.length} skills)`;
  }

  return `repo: ${candidate.ownerRepo} (${candidate.skills.length} skills)`;
}

function renderBatchResult(group: string, result: AddSkillResult): string {
  const skillName = skillNameFromKey(result.skillKey);

  if (result.status === 'added') {
    return `  ✓ ${skillName}`;
  }

  if (result.status === 'already-present') {
    return `  · ${skillName} (already in ${group}, skipped)`;
  }

  if (result.status === 'replaced') {
    return `  ⚠ ${skillName} (name conflict with ${result.conflictKey}, replaced)`;
  }

  return `  · ${skillName} (name conflict with ${result.conflictKey}, skipped)`;
}

function countAddedResults(results: AddSkillResult[]): number {
  return results.filter((result) => result.status === 'added').length;
}

export function checkNameConflict(
  targetGroupKeys: string[],
  newKey: string,
): string | null {
  const newName = skillNameFromKey(newKey);
  return targetGroupKeys.find((key) =>
    key !== newKey && skillNameFromKey(key) === newName
  ) ?? null;
}

export async function resolveGroupAddIdentifier(
  identifier: string,
  targetGroup: string,
  allSkills: SkillInfo[],
  groupsService: GroupsService,
): Promise<GroupAddCandidate> {
  const candidates: GroupAddCandidate[] = [];
  const fullKeyMatch = allSkills.find((skill) => skillKeyOf(skill) === identifier);
  const nameMatches = allSkills.filter((skill) => skill.name === identifier);
  const groupEntry = groupsService.getGroup(identifier);
  const groupSkills = groupEntry ? groupsService.getGroupMembers(identifier) : null;
  const isOwnerRepo = detectArgFormat(identifier) === 'owner-repo';
  const repoSkills = isOwnerRepo
    ? findRepoInCentralRepository(identifier, new SkillsService(SKILLS_MANAGER_DIR))
    : null;

  if (fullKeyMatch) {
    candidates.push({ type: 'skill', skill: fullKeyMatch });
  }

  for (const skill of nameMatches) {
    candidates.push({ type: 'skill', skill });
  }

  if (groupSkills !== null) {
    candidates.push({
      type: 'group',
      name: identifier,
      skillKeys: groupSkills,
    });
  }

  if (repoSkills) {
    candidates.push({
      type: 'repo',
      ownerRepo: identifier,
      skills: repoSkills,
    });
  }

  const filteredCandidates = candidates.filter((candidate) =>
    candidate.type !== 'group' || candidate.name !== targetGroup
  );

  if (filteredCandidates.length === 0) {
    if (groupSkills !== null && identifier === targetGroup) {
      throw new Error('Cannot add a group to itself.');
    }

    if (isOwnerRepo && repoSkills === null) {
      throw new Error(`No installed skills found for '${identifier}'.`);
    }

    throw new Error(`No skill, group, or repo found for '${identifier}'.`);
  }

  if (filteredCandidates.length === 1) {
    return filteredCandidates[0];
  }

  const selectedValue = await promptSelect(
    'Which one?',
    filteredCandidates.map((candidate) => ({
      name: candidateLabel(candidate),
      value: candidateValue(candidate),
    })),
  );

  return filteredCandidates.find((candidate) =>
    candidateValue(candidate) === selectedValue
  ) ?? filteredCandidates[0];
}

async function addSkillWithConflictHandling(
  group: string,
  skillKey: string,
  service: GroupsService,
): Promise<AddSkillResult> {
  const targetGroupKeys = service.getGroupMembers(group);

  if (targetGroupKeys.includes(skillKey)) {
    return { status: 'already-present', skillKey };
  }

  const conflictKey = checkNameConflict(targetGroupKeys, skillKey);
  if (!conflictKey) {
    service.addSkill(group, skillKey);
    return { status: 'added', skillKey };
  }

  const resolution = await promptGroupAddConflictResolution(group, conflictKey, skillKey);
  if (resolution === 'skip') {
    return {
      status: 'skipped',
      skillKey,
      conflictKey,
    };
  }

  service.removeSkill(group, conflictKey);
  service.addSkill(group, skillKey);
  return {
    status: 'replaced',
    skillKey,
    conflictKey,
  };
}

function logSingleAddResult(group: string, result: AddSkillResult): void {
  const skillName = skillNameFromKey(result.skillKey);

  if (result.status === 'already-present') {
    console.log(`Skill '${skillName}' is already in group '${group}'.`);
    return;
  }

  if (result.status === 'added') {
    console.log(`Added '${result.skillKey}' to group '${group}'.`);
    return;
  }

  if (result.status === 'replaced') {
    console.log(
      `Replaced '${result.conflictKey}' with '${result.skillKey}' in group '${group}'.`,
    );
    return;
  }

  console.log(
    `Skipped '${result.skillKey}' due to name conflict with '${result.conflictKey}' in group '${group}'.`,
  );
}

async function addGroupSkills(
  targetGroup: string,
  sourceGroup: string,
  skillKeys: string[],
  service: GroupsService,
): Promise<void> {
  if (skillKeys.length === 0) {
    console.log(`Group '${sourceGroup}' is empty, nothing to add.`);
    return;
  }

  const results: AddSkillResult[] = [];
  for (const skillKey of skillKeys) {
    results.push(await addSkillWithConflictHandling(targetGroup, skillKey, service));
  }

  console.log(
    `Added ${countAddedResults(results)} skills from group '${sourceGroup}' to '${targetGroup}':`,
  );
  for (const result of results) {
    console.log(renderBatchResult(targetGroup, result));
  }
}

async function addRepoSkills(
  targetGroup: string,
  ownerRepo: string,
  skills: SkillInfo[],
  service: GroupsService,
): Promise<void> {
  const results: AddSkillResult[] = [];
  for (const skill of skills) {
    results.push(await addSkillWithConflictHandling(targetGroup, skillKeyOf(skill), service));
  }

  console.log(
    `Added ${countAddedResults(results)} skills from repo '${ownerRepo}' to '${targetGroup}':`,
  );
  for (const result of results) {
    console.log(renderBatchResult(targetGroup, result));
  }
}

function renderBatchRemoveResult(group: string, result: RemoveSkillResult): string {
  const skillName = skillNameFromKey(result.skillKey);

  if (result.status === 'removed') {
    return `  · ${skillName} (removed)`;
  }

  return `  · ${skillName} (not in ${group}, skipped)`;
}

function countRemovedResults(results: RemoveSkillResult[]): number {
  return results.filter((r) => r.status === 'removed').length;
}

function removeGroupSkills(
  targetGroup: string,
  sourceGroup: string,
  skillKeys: string[],
  service: GroupsService,
): void {
  if (skillKeys.length === 0) {
    console.log(`Group '${sourceGroup}' is empty, nothing to remove.`);
    return;
  }

  const targetKeys = service.getGroupMembers(targetGroup);
  const results: RemoveSkillResult[] = skillKeys.map((key) => {
    if (targetKeys.includes(key)) {
      service.removeSkill(targetGroup, key);
      return { status: 'removed' as const, skillKey: key };
    }
    return { status: 'not-present' as const, skillKey: key };
  });

  console.log(
    `Removed ${countRemovedResults(results)} skills from group '${sourceGroup}' in '${targetGroup}':`,
  );
  for (const result of results) {
    console.log(renderBatchRemoveResult(targetGroup, result));
  }
}

function removeRepoSkills(
  targetGroup: string,
  ownerRepo: string,
  skills: SkillInfo[],
  service: GroupsService,
): void {
  const targetKeys = service.getGroupMembers(targetGroup);
  const results: RemoveSkillResult[] = skills.map((skill) => {
    const key = skillKeyOf(skill);
    if (targetKeys.includes(key)) {
      service.removeSkill(targetGroup, key);
      return { status: 'removed' as const, skillKey: key };
    }
    return { status: 'not-present' as const, skillKey: key };
  });

  console.log(
    `Removed ${countRemovedResults(results)} skills from repo '${ownerRepo}' in '${targetGroup}':`,
  );
  for (const result of results) {
    console.log(renderBatchRemoveResult(targetGroup, result));
  }
}

async function executeGroupList(name?: string): Promise<void> {
  await ensureSetup();
  const service = new GroupsService();

  if (name) {
    const group = service.getGroup(name);
    if (!group) {
      console.log(`Group '${name}' not found.`);
      process.exit(1);
    }
    const skills = service.getGroupMembers(name);
    if (skills.length === 0) {
      console.log(`Group '${name}' is empty.`);
      return;
    }
    console.log(`${name} [${group.kind}]:`);
    for (const key of skills) {
      const lastSlash = key.lastIndexOf('/');
      const skillName = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
      const source = lastSlash >= 0 ? key.slice(0, lastSlash) : '';
      const suffix = getSourceSuffix(source);
      console.log(suffix ? `  ${skillName}  ${suffix}` : `  ${skillName}`);
    }
    return;
  }

  const groups = service.listGroups();
  if (groups.length === 0) {
    console.log('No groups defined.');
    return;
  }

  for (const group of groups) {
    const skills = service.getGroupMembers(group);
    const kind = service.getGroupKind(group) ?? 'virtual';
    console.log(`${group} [${kind}] (${skills.length})`);
  }
}

async function executeGroupCreate(name: string): Promise<void> {
  await ensureSetup();
  try {
    validateGroupName(name);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  const service = new GroupsService();
  try {
    service.createGroup(name);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }
  console.log(`Created group '${name}'.`);
}

async function executeGroupDelete(name: string): Promise<void> {
  await ensureSetup();
  const service = new GroupsService();
  try {
    service.deleteGroup(name);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }
  console.log(`Deleted group '${name}'.`);
}

async function executeGroupInstall(
  source: string,
  options: InstallOptions,
): Promise<void> {
  await ensureSetup();
  const groupManager = new GroupManager();

  try {
    await groupManager.installLocalBatch(resolveLocalSourcePath(source), options);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }
}

async function executeGroupUninstall(
  name: string,
  options: { force?: boolean } = {},
): Promise<void> {
  await ensureSetup();
  const groupsService = new GroupsService();
  const kind = groupsService.getGroupKind(name);

  if (!kind) {
    console.log(`Group '${name}' not found.`);
    process.exit(1);
  }

  if (kind === 'virtual') {
    console.log(
      `'${name}' is a virtual group; use 'group delete ${name}' to remove it (skills are not affected)`,
    );
    process.exit(1);
  }

  const groupManager = new GroupManager();
  const result = await groupManager.uninstallPhysicalGroup(name, {
    force: options.force,
  });
  if (result.removed > 0) {
    console.log(`Uninstalled ${result.removed} skills from physical group ${name}.`);
  }
}

async function executeGroupUpdate(
  name: string,
  options: { keepLocal?: boolean; verbose?: boolean } = {},
): Promise<void> {
  await ensureSetup();
  const groupsService = new GroupsService();
  const kind = groupsService.getGroupKind(name);

  if (!kind) {
    console.log(`Group '${name}' not found.`);
    process.exit(1);
  }

  const groupManager = new GroupManager();
  console.log(`Updating ${name}...\n`);

  if (kind === 'local-batch') {
    try {
      const result = await groupManager.updatePhysicalGroup(name, {
        keepLocal: options.keepLocal,
        verbose: options.verbose,
      });
      console.log(
        `\nDone! ${result.updated} updated, ${result.added} added, ` +
        `${result.kept} removed (kept), ${result.removed} removed, ` +
        `${result.upToDate} up to date, ${result.failed} failed`,
      );
    } catch (e) {
      console.log((e as Error).message);
      process.exit(1);
    }
    return;
  }

  const result = await groupManager.updateVirtualGroup(name);
  console.log(
    `\nDone! ${result.updated} updated, ${result.upToDate} up to date, ` +
    `${result.failed} failed, ${result.skipped} skipped`,
  );
}

export async function executeGroupAdd(group: string, identifier: string): Promise<void> {
  await ensureSetup();
  if (isCollectionGroupKey(group)) {
    console.log(`Cannot manually modify collection group '${group}'. Use 'skillsmgr update ${group}' to re-sync.`);
    process.exit(1);
  }
  try {
    validateGroupName(group);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  const service = new GroupsService();
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();

  let candidate: GroupAddCandidate;
  try {
    candidate = await resolveGroupAddIdentifier(identifier, group, allSkills, service);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  if (candidate.type === 'skill') {
    const result = await addSkillWithConflictHandling(
      group,
      skillKeyOf(candidate.skill),
      service,
    );
    logSingleAddResult(group, result);
    return;
  }

  if (candidate.type === 'group') {
    await addGroupSkills(group, candidate.name, candidate.skillKeys, service);
    return;
  }

  await addRepoSkills(group, candidate.ownerRepo, candidate.skills, service);
}

export async function executeGroupRemove(group: string, identifier: string): Promise<void> {
  await ensureSetup();
  if (isCollectionGroupKey(group)) {
    console.log(`Cannot manually modify collection group '${group}'. Use 'skillsmgr update ${group}' to re-sync.`);
    process.exit(1);
  }
  const service = new GroupsService();

  const groupSkills = service.getGroup(group);
  if (!groupSkills) {
    console.log(`Group '${group}' not found.`);
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();

  let candidate: GroupAddCandidate;
  try {
    candidate = await resolveGroupAddIdentifier(identifier, group, allSkills, service);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'Cannot add a group to itself.') {
      console.log('Cannot remove a group from itself.');
    } else {
      console.log(msg);
    }
    process.exit(1);
  }

  if (candidate.type === 'skill') {
    const skillKey = skillKeyOf(candidate.skill);
    const removed = service.removeSkill(group, skillKey);
    if (!removed) {
      console.log(`Skill '${skillKey}' is not in group '${group}'.`);
      return;
    }
    console.log(`Removed '${skillKey}' from group '${group}'.`);
    return;
  }

  if (candidate.type === 'group') {
    removeGroupSkills(group, candidate.name, candidate.skillKeys, service);
    return;
  }

  removeRepoSkills(group, candidate.ownerRepo, candidate.skills, service);
}

export async function executeGroupRename(
  oldName: string,
  newName: string,
): Promise<void> {
  await ensureSetup();
  const service = new GroupsService();
  const group = service.getGroup(oldName);

  if (!group) {
    console.log(`Group '${oldName}' not found.`);
    process.exit(1);
  }

  try {
    if (group.kind === 'local-batch') {
      new GroupManager().renamePhysicalGroup(oldName, newName);
    } else {
      service.renameGroup(oldName, newName);
    }
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  console.log(`Renamed group '${oldName}' to '${newName}'.`);
}

export const groupCommand = new Command('group')
  .description('Manage skill groups');

groupCommand
  .command('list')
  .argument('[name]', 'Group name to show details')
  .description('List all groups or show group details')
  .action((name?: string) => {
    executeGroupList(name);
  });

groupCommand
  .command('install')
  .argument('<source>', 'Local directory containing multiple skills')
  .description('Install a physical group from a local directory')
  .option('--all', 'Install all skills without prompting')
  .option('-y', 'Skip all prompts (implies --all)')
  .option('-f, --force', 'Overwrite existing skills without confirmation')
  .option('-s, --skill <name>', 'Specific skill to install (repeatable)', collect, [])
  .action(async (source: string, options: InstallOptions) => {
    await executeGroupInstall(source, options);
  });

groupCommand
  .command('create')
  .argument('<name>', 'Group name')
  .description('Create a new empty group')
  .action((name: string) => {
    executeGroupCreate(name);
  });

groupCommand
  .command('delete')
  .argument('<name>', 'Group name')
  .description('Delete a virtual group (skills are not affected)')
  .action((name: string) => {
    executeGroupDelete(name);
  });

groupCommand
  .command('uninstall')
  .argument('<name>', 'Group name')
  .description('Uninstall a physical group')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (name: string, options: { force?: boolean }) => {
    await executeGroupUninstall(name, options);
  });

groupCommand
  .command('update')
  .argument('<name>', 'Group name')
  .description('Update a physical or virtual group')
  .option('--keep-local', 'Keep orphaned skills when updating a physical group')
  .option('-v, --verbose', 'Show every physical group member status during sync')
  .action(async (name: string, options: { keepLocal?: boolean; verbose?: boolean }) => {
    await executeGroupUpdate(name, options);
  });

groupCommand
  .command('add')
  .argument('<group>', 'Group name')
  .argument('<identifier>', 'Skill name, full source key, group name, or owner/repo')
  .description('Add a skill, group, or repo to a group')
  .action(async (group: string, identifier: string) => {
    await executeGroupAdd(group, identifier);
  });

groupCommand
  .command('remove')
  .argument('<group>', 'Group name')
  .argument('<identifier>', 'Skill name, full source key, group name, or owner/repo')
  .description('Remove skills from a group')
  .action(async (group: string, identifier: string) => {
    await executeGroupRemove(group, identifier);
  });

groupCommand
  .command('rename')
  .argument('<old-name>', 'Current group name')
  .argument('<new-name>', 'New group name')
  .description('Rename a group')
  .action(async (oldName: string, newName: string) => {
    await executeGroupRename(oldName, newName);
  });

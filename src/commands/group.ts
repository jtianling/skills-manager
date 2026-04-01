import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { SkillsService } from '../services/skills.js';
import type { SkillInfo } from '../types.js';
import {
  getSourceSuffix,
  promptGroupAddConflictResolution,
  promptSelect,
} from '../utils/prompts.js';
import { detectArgFormat, findRepoInCentralRepository } from '../utils/repo-lookup.js';
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
  const groupSkills = groupsService.getGroup(identifier);
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
  const targetGroupKeys = service.getGroup(group) ?? [];

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

  const targetKeys = service.getGroup(targetGroup) ?? [];
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
  const targetKeys = service.getGroup(targetGroup) ?? [];
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
    const skills = service.getGroup(name);
    if (!skills) {
      console.log(`Group '${name}' not found.`);
      process.exit(1);
    }
    if (skills.length === 0) {
      console.log(`Group '${name}' is empty.`);
      return;
    }
    console.log(`${name}:`);
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
    const skills = service.getGroup(group) ?? [];
    console.log(`${group} (${skills.length})`);
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

export async function executeGroupAdd(group: string, identifier: string): Promise<void> {
  await ensureSetup();
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

  try {
    service.renameGroup(oldName, newName);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  console.log(`Renamed group '${oldName}' to '${newName}'.`);
}

export const groupCommand = new Command('group')
  .description('Manage virtual skill groups');

groupCommand
  .command('list')
  .argument('[name]', 'Group name to show details')
  .description('List all groups or show group details')
  .action((name?: string) => {
    executeGroupList(name);
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
  .description('Delete a group (skills are not affected)')
  .action((name: string) => {
    executeGroupDelete(name);
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

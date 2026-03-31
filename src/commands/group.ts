import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { SkillsService } from '../services/skills.js';
import { getSourceSuffix } from '../utils/prompts.js';
import { resolveSkillByName } from '../utils/skill-resolve.js';
import { ensureSetup } from './setup.js';

async function resolveSkillKey(skillIdentifier: string): Promise<string> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();
  const skill = await resolveSkillByName(skillIdentifier, allSkills);

  if (!skill) {
    console.log(`Skill '${skillIdentifier}' not found.`);
    process.exit(1);
  }

  return `${skill.source}/${skill.name}`;
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

async function executeGroupAdd(group: string, skill: string): Promise<void> {
  await ensureSetup();
  try {
    validateGroupName(group);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  const skillKey = await resolveSkillKey(skill);
  const service = new GroupsService();

  const added = service.addSkill(group, skillKey);
  if (!added) {
    const skillName = skillKey.split('/').pop();
    console.log(`Skill '${skillName}' is already in group '${group}'.`);
    return;
  }

  console.log(`Added '${skillKey}' to group '${group}'.`);
}

async function executeGroupRemove(group: string, skill: string): Promise<void> {
  await ensureSetup();
  const service = new GroupsService();

  const groupSkills = service.getGroup(group);
  if (!groupSkills) {
    console.log(`Group '${group}' not found.`);
    process.exit(1);
  }

  const skillKey = await resolveSkillKey(skill);
  const removed = service.removeSkill(group, skillKey);
  if (!removed) {
    console.log(`Skill '${skillKey}' is not in group '${group}'.`);
    return;
  }

  console.log(`Removed '${skillKey}' from group '${group}'.`);
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
  .argument('<skill>', 'Skill name or full source key')
  .description('Add a skill to a group')
  .action(async (group: string, skill: string) => {
    await executeGroupAdd(group, skill);
  });

groupCommand
  .command('remove')
  .argument('<group>', 'Group name')
  .argument('<skill>', 'Skill name or full source key')
  .description('Remove a skill from a group')
  .action(async (group: string, skill: string) => {
    await executeGroupRemove(group, skill);
  });

groupCommand
  .command('rename')
  .argument('<old-name>', 'Current group name')
  .argument('<new-name>', 'New group name')
  .description('Rename a group')
  .action(async (oldName: string, newName: string) => {
    await executeGroupRename(oldName, newName);
  });

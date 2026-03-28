import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GroupsService, validateGroupName } from '../services/groups.js';
import { SkillsService } from '../services/skills.js';
import { fileExists } from '../utils/fs.js';

function ensureSetup(): void {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }
}

function resolveSkillKey(skillIdentifier: string): string {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();

  const fullKeyMatch = allSkills.find(
    (s) => `${s.source}/${s.name}` === skillIdentifier,
  );
  if (fullKeyMatch) {
    return `${fullKeyMatch.source}/${fullKeyMatch.name}`;
  }

  const nameMatches = allSkills.filter((s) => s.name === skillIdentifier);

  if (nameMatches.length === 0) {
    console.log(`Skill '${skillIdentifier}' not found.`);
    process.exit(1);
  }

  if (nameMatches.length > 1) {
    console.log(`Multiple skills named '${skillIdentifier}'. Specify full key:`);
    for (const s of nameMatches) {
      console.log(`  ${s.source}/${s.name}`);
    }
    process.exit(1);
  }

  return `${nameMatches[0].source}/${nameMatches[0].name}`;
}

function executeGroupList(name?: string): void {
  ensureSetup();
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
      console.log(`  ${key}`);
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

function executeGroupCreate(name: string): void {
  ensureSetup();
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

function executeGroupDelete(name: string): void {
  ensureSetup();
  const service = new GroupsService();
  try {
    service.deleteGroup(name);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }
  console.log(`Deleted group '${name}'.`);
}

function executeGroupAdd(group: string, skill: string): void {
  ensureSetup();
  try {
    validateGroupName(group);
  } catch (e) {
    console.log((e as Error).message);
    process.exit(1);
  }

  const skillKey = resolveSkillKey(skill);
  const service = new GroupsService();

  const added = service.addSkill(group, skillKey);
  if (!added) {
    const skillName = skillKey.split('/').pop();
    console.log(`Skill '${skillName}' is already in group '${group}'.`);
    return;
  }

  console.log(`Added '${skillKey}' to group '${group}'.`);
}

function executeGroupRemove(group: string, skill: string): void {
  ensureSetup();
  const service = new GroupsService();

  const groupSkills = service.getGroup(group);
  if (!groupSkills) {
    console.log(`Group '${group}' not found.`);
    process.exit(1);
  }

  const skillKey = resolveSkillKey(skill);
  const removed = service.removeSkill(group, skillKey);
  if (!removed) {
    console.log(`Skill '${skillKey}' is not in group '${group}'.`);
    return;
  }

  console.log(`Removed '${skillKey}' from group '${group}'.`);
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
  .action((group: string, skill: string) => {
    executeGroupAdd(group, skill);
  });

groupCommand
  .command('remove')
  .argument('<group>', 'Group name')
  .argument('<skill>', 'Skill name or full source key')
  .description('Remove a skill from a group')
  .action((group: string, skill: string) => {
    executeGroupRemove(group, skill);
  });

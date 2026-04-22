import { lstatSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { GroupsService } from '../services/groups.js';
import { DeploymentScanner, type ScannedSkill } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { readSymlinkTarget } from '../utils/fs.js';
import { ensureSetup } from './setup.js';
import {
  buildSourceGroupedChoices,
  buildVirtualGroupChoices,
  loadGroupsData,
  resolveTargetAgents,
} from '../utils/prompts.js';
import { type RemoveOptions, type SkillInfo, type ToolName, collect } from '../types.js';
import { detectArgFormat, findRepoInCentralRepository } from '../utils/repo-lookup.js';
import { extractOwnerRepo } from '../utils/source-detection.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';
import { expandCollectionRefToSkillNames } from './install-collection.js';

interface ResolvedDeployedSkill extends ScannedSkill {
  skillKey: string | null;
}

function resolveSkillNames(
  name: string | undefined,
  options: RemoveOptions,
): string[] {
  const names: string[] = [];
  if (name) names.push(name);
  if (options.skill && options.skill.length > 0) {
    for (const skillName of options.skill) {
      if (!names.includes(skillName)) {
        names.push(skillName);
      }
    }
  }
  return names;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function skillKeyOf(source: string, name: string): string {
  return `${source}/${name}`;
}

function pathOrLinkExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function resolveLinkedSkillSource(skillPath: string): string | null {
  const linkTarget = readSymlinkTarget(skillPath);
  if (!linkTarget) {
    return null;
  }

  const absoluteTarget = isAbsolute(linkTarget)
    ? linkTarget
    : resolve(dirname(skillPath), linkTarget);
  const relativeTarget = normalizePath(relative(SKILLS_MANAGER_DIR, absoluteTarget));

  if (!relativeTarget || relativeTarget.startsWith('..')) {
    return null;
  }

  const parts = relativeTarget.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return parts.slice(0, -1).join('/');
}

function resolveDeployedSkillKey(
  skill: ScannedSkill,
  skillsService: SkillsService,
): string | null {
  const linkedSource = skill.deployMode === 'link'
    ? resolveLinkedSkillSource(skill.path)
    : null;
  const knownSource = skill.source !== 'unknown' ? skill.source : null;
  const source = linkedSource ?? knownSource;

  if (source) {
    return skillKeyOf(source, skill.name);
  }

  const matches = skillsService.findSkillsByName(skill.name);
  if (matches.length === 1) {
    return skillKeyOf(matches[0].source, matches[0].name);
  }

  return null;
}

function resolveDeployedSkills(
  skills: ScannedSkill[],
  skillsService: SkillsService,
): ResolvedDeployedSkill[] {
  return skills.map((skill) => ({
    ...skill,
    skillKey: resolveDeployedSkillKey(skill, skillsService),
  }));
}

function cleanupGroupRefs(skillKeys: Array<string | null>): void {
  const groupsService = new GroupsService();
  const uniqueKeys = [...new Set(skillKeys.filter((skillKey): skillKey is string => Boolean(skillKey)))];

  for (const skillKey of uniqueKeys) {
    groupsService.removeSkillFromAll(skillKey);
  }
}

function findMatchingRepoSkills(
  ownerRepo: string,
  scanner: DeploymentScanner,
  skillsService: SkillsService,
): ScannedSkill[] | null {
  const repoSkills = findRepoInCentralRepository(ownerRepo, skillsService);
  if (!repoSkills) {
    return null;
  }

  const repoSkillByName = new Map(repoSkills.map((skill) => [skill.name, skill]));
  const matchedSkills = new Map<string, ScannedSkill>();

  for (const deployedSkill of scanner.getDeployedSkills()) {
    const repoSkill = repoSkillByName.get(deployedSkill.name);
    if (!repoSkill) {
      continue;
    }

    const isMatch = deployedSkill.deployMode === 'link'
      ? normalizePath(readSymlinkTarget(deployedSkill.path) ?? '') === normalizePath(repoSkill.path)
      : deployedSkill.source === repoSkill.source;

    if (isMatch && !matchedSkills.has(deployedSkill.name)) {
      matchedSkills.set(deployedSkill.name, deployedSkill);
    }
  }

  return [...matchedSkills.values()];
}

function removeSkillNames(
  skillNames: string[],
  deployer: Deployer,
  json?: boolean,
): Array<{ name: string }> {
  const removed: Array<{ name: string }> = [];
  for (const skillName of skillNames) {
    deployer.removeSkill(skillName);
    removed.push({ name: skillName });
    if (!json) console.log(`  ✓ Removed ${skillName}`);
  }
  return removed;
}

function removeSkillNamesGlobal(
  skillNames: string[],
  deployer: Deployer,
  agents: ToolName[],
): string[] {
  const removedNames: string[] = [];

  for (const skillName of skillNames) {
    const removed = deployer.removeSkillGlobal(skillName, agents);
    if (removed) {
      removedNames.push(skillName);
    }
  }

  return removedNames;
}

function resolveSkillInfosByKeys(
  skillKeys: string[],
  skillsService: SkillsService,
): SkillInfo[] {
  const keySet = new Set(skillKeys);
  return skillsService.getAllSkills().filter((skill) => keySet.has(skillKeyOf(skill.source, skill.name)));
}

function filterGloballyDeployedSkills(
  skills: SkillInfo[],
  agents: ToolName[],
): SkillInfo[] {
  return skills.filter((skill) =>
    agents.some((agent) => pathOrLinkExists(join(TOOL_CONFIGS[agent].globalSkillsDir, skill.name)))
  );
}

async function removeByGroup(
  groupName: string,
  options: RemoveOptions,
): Promise<void> {
  const groupsService = new GroupsService();
  const groupEntry = groupsService.getGroup(groupName);
  const groupSkillKeys = groupEntry ? groupsService.getGroupMembers(groupName) : null;

  if (!groupSkillKeys) {
    if (options.json) {
      jsonError(`Group '${groupName}' not found.`, 'NOT_FOUND');
      process.exit(1);
    }
    console.log(`Group '${groupName}' not found.`);
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);

  if (options.global) {
    const agents = await resolveTargetAgents(
      { agent: options.agent, sameAgents: options.sameAgents },
      () => [] as ToolName[],
      true,
    );
    const deployer = new Deployer(process.cwd());
    const groupSkills = resolveSkillInfosByKeys(groupSkillKeys, skillsService);
    const deployedGroupSkills = filterGloballyDeployedSkills(groupSkills, agents);

    if (deployedGroupSkills.length === 0) {
      console.log(`No deployed skills found in group '${groupName}'.`);
      process.exit(1);
    }

    const selectedSkillNames = options.all
      ? deployedGroupSkills.map((skill) => skill.name)
      : await interactiveCheckbox({
          message: `Select skills to remove from group '${groupName}':`,
          choices: deployedGroupSkills.map((skill) => ({
            name: skill.name,
            value: skill.name,
          })),
        });

    if (selectedSkillNames.length === 0) {
      console.log('No skills selected.');
      return;
    }

    const removedNames = removeSkillNamesGlobal(selectedSkillNames, deployer, agents);
    if (removedNames.length === 0) {
      console.log(`No deployed skills found in group '${groupName}'.`);
      process.exit(1);
    }

    cleanupGroupRefs(
      deployedGroupSkills
        .filter((skill) => removedNames.includes(skill.name))
        .map((skill) => skillKeyOf(skill.source, skill.name)),
    );
    return;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const deployedSkills = resolveDeployedSkills(scanner.getDeployedSkills(), skillsService);
  const groupSkillSet = new Set(groupSkillKeys);
  const deployedGroupSkills = deployedSkills.filter((skill) =>
    skill.skillKey ? groupSkillSet.has(skill.skillKey) : false
  );

  if (deployedGroupSkills.length === 0) {
    console.log(`No deployed skills found in group '${groupName}'.`);
    process.exit(1);
  }

  const selectedSkillNames = options.all
    ? deployedGroupSkills.map((skill) => skill.name)
    : await interactiveCheckbox({
        message: `Select skills to remove from group '${groupName}':`,
        choices: deployedGroupSkills.map((skill) => ({
          name: skill.name,
          value: skill.name,
        })),
      });

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected.');
    return;
  }

  const removed = removeSkillNames(selectedSkillNames, deployer, options.json);
  if (options.json) {
    jsonOutput({ removed });
  }
  cleanupGroupRefs(
    deployedGroupSkills
      .filter((skill) => selectedSkillNames.includes(skill.name))
      .map((skill) => skill.skillKey),
  );
}

async function removeByOwnerRepo(
  ownerRepo: string,
  options: RemoveOptions,
  explicitSkillNames: string[],
): Promise<string[]> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);

  if (options.global) {
    const repoSkills = findRepoInCentralRepository(ownerRepo, skillsService);
    if (!repoSkills) {
      if (options.json) {
        jsonError(`'${ownerRepo}' not found in central repository`, 'NOT_FOUND');
        process.exit(1);
      }
      console.log(`'${ownerRepo}' not found in central repository`);
      process.exit(1);
    }

    const allNames = [...new Set(repoSkills.map((skill) => skill.name))];
    const targetNames = explicitSkillNames.length > 0
      ? allNames.filter((name) => explicitSkillNames.includes(name))
      : allNames;

    const agents = await resolveTargetAgents(
      { agent: options.agent, sameAgents: options.sameAgents },
      () => [] as ToolName[],
      true,
    );
    const deployer = new Deployer(process.cwd());
    const removedNames = removeSkillNamesGlobal(targetNames, deployer, agents);

    if (removedNames.length === 0) {
      if (options.json) {
        jsonError(`No deployed skills found from '${ownerRepo}'`, 'NOT_FOUND');
        process.exit(1);
      }
      console.log(`No deployed skills found from '${ownerRepo}'`);
      process.exit(1);
    }

    cleanupGroupRefs(
      repoSkills
        .filter((skill) => removedNames.includes(skill.name))
        .map((skill) => skillKeyOf(skill.source, skill.name)),
    );
    return removedNames;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const matchedSkills = findMatchingRepoSkills(ownerRepo, scanner, skillsService);

  if (!matchedSkills) {
    if (options.json) {
      jsonError(`'${ownerRepo}' not found in central repository`, 'NOT_FOUND');
      process.exit(1);
    }
    console.log(`'${ownerRepo}' not found in central repository`);
    process.exit(1);
  }

  if (matchedSkills.length === 0) {
    if (options.json) {
      jsonError(`No deployed skills found from '${ownerRepo}'`, 'NOT_FOUND');
      process.exit(1);
    }
    console.log(`No deployed skills found from '${ownerRepo}'`);
    process.exit(1);
  }

  const resolvedSkills = resolveDeployedSkills(matchedSkills, skillsService);
  let selectedSkillNames: string[];

  if (explicitSkillNames.length > 0) {
    selectedSkillNames = resolvedSkills
      .map((skill) => skill.name)
      .filter((name) => explicitSkillNames.includes(name));

    if (selectedSkillNames.length === 0) {
      console.log(`No matching skills from '${ownerRepo}' for: ${explicitSkillNames.join(', ')}`);
      return [];
    }
  } else if (options.all) {
    selectedSkillNames = resolvedSkills.map((skill) => skill.name);
  } else {
    const groupsService = new GroupsService();
    const selected = await interactiveCheckbox({
      message: `Select skills to remove from '${ownerRepo}':`,
      choices: buildVirtualGroupChoices(
        resolvedSkills.map((skill) => ({
          ...skill,
          source: skill.skillKey
            ? skill.skillKey.slice(0, -(skill.name.length + 1))
            : skill.source,
        })),
        loadGroupsData(groupsService),
        { getValue: (skill) => skill.name },
      ),
    });
    if (selected.length === 0) {
      console.log('No skills selected.');
      return [];
    }
    selectedSkillNames = selected;
  }

  const removedByRepo = removeSkillNames(selectedSkillNames, deployer, options.json);
  if (options.json) {
    jsonOutput({ removed: removedByRepo });
  }
  cleanupGroupRefs(
    resolvedSkills
      .filter((skill) => selectedSkillNames.includes(skill.name))
      .map((skill) => skill.skillKey),
  );
  return selectedSkillNames;
}

async function interactiveRemove(): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const groupsService = new GroupsService();
  const deployedSkills = resolveDeployedSkills(scanner.getDeployedSkills(), skillsService);

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    return;
  }

  const mappedSkills = deployedSkills.map((skill) => ({
    ...skill,
    source: skill.skillKey
      ? skill.skillKey.slice(0, -(skill.name.length + 1))
      : skill.source,
  }));
  const choices = buildSourceGroupedChoices(
    mappedSkills,
    loadGroupsData(groupsService),
    { getValue: (skill) => skill.name },
  );
  const selected = await interactiveCheckbox({
    message: 'Select skills to remove:',
    choices,
  });

  if (selected.length === 0) {
    console.log('No skills selected.');
    return;
  }

  removeSkillNames(selected, deployer);
  cleanupGroupRefs(
    deployedSkills
      .filter((skill) => selected.includes(skill.name))
      .map((skill) => skill.skillKey),
  );
}

export async function executeRemove(
  name: string | undefined,
  options: RemoveOptions = {},
): Promise<void> {
  if (options.json || options.y) {
    if (!options.all) options.all = true;
    if (!options.agent?.length && !options.sameAgents) options.sameAgents = true;
  }

  if (options.from) {
    try {
      const expanded = await expandCollectionRefToSkillNames(options.from);
      if (!expanded) return;

      await ensureSetup();
      const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
      const deployedNames = new Set(scanner.getDeployedSkills().map((s) => s.name));

      const toRemove: string[] = [];
      for (const name of expanded.skillNames) {
        if (deployedNames.has(name)) {
          toRemove.push(name);
        } else {
          console.log(`  · ${name} (not deployed, skipped)`);
        }
      }

      if (toRemove.length === 0) {
        console.log(`No deployed skills from collection '${expanded.normalizedRef}'.`);
        return;
      }

      options = {
        ...options,
        skill: [...(options.skill ?? []), ...toRemove],
        all: true,
      };
      console.log(`Removing ${toRemove.length} skills from collection '${expanded.normalizedRef}'...`);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  await ensureSetup();

  const skillNames = resolveSkillNames(name, options);

  if (options.group && skillNames.length > 0) {
    console.log('Cannot use --group with skill name argument.');
    process.exit(1);
  }

  if (options.group) {
    await removeByGroup(options.group, options);
    return;
  }

  if (skillNames.length === 0 && !options.all) {
    await interactiveRemove();
    return;
  }

  if (skillNames.length === 0 && options.all) {
    const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
    const deployer = new Deployer(process.cwd());
    const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
    const deployedSkills = resolveDeployedSkills(scanner.getDeployedSkills(), skillsService);

    if (deployedSkills.length === 0) {
      if (options.json) {
        jsonError('No skills deployed in current project.', 'NOT_FOUND');
        process.exit(1);
      }
      console.log('No skills deployed in current project.');
      process.exit(1);
    }

    const allNames = deployedSkills.map((s) => s.name);
    const removed = removeSkillNames(allNames, deployer, options.json);
    if (options.json) {
      jsonOutput({ removed });
    }
    cleanupGroupRefs(deployedSkills.map((s) => s.skillKey));
    return;
  }

  const ownerRepos = skillNames
    .filter((skillName) => detectArgFormat(skillName) === 'owner-repo')
    .map((skillName) => extractOwnerRepo(skillName) ?? skillName);
  let plainSkillNames = skillNames.filter((skillName) => detectArgFormat(skillName) !== 'owner-repo');

  for (const ownerRepo of ownerRepos) {
    const consumed = await removeByOwnerRepo(ownerRepo, options, plainSkillNames);
    plainSkillNames = plainSkillNames.filter((skillName) => !consumed.includes(skillName));
  }

  if (plainSkillNames.length === 0) {
    return;
  }

  if (options.global) {
    const agents = await resolveTargetAgents(
      { agent: options.agent, sameAgents: options.sameAgents },
      () => [] as ToolName[],
      true,
    );
    const deployer = new Deployer(process.cwd());
    const removedNames = removeSkillNamesGlobal(plainSkillNames, deployer, agents);

    for (const skillName of plainSkillNames) {
      if (!removedNames.includes(skillName)) {
        console.log(`'${skillName}' not found in global agent directories`);
      }
    }

    const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
    cleanupGroupRefs(
      removedNames.flatMap((skillName) =>
        skillsService.findSkillsByName(skillName).map((skill) => skillKeyOf(skill.source, skill.name))
      ),
    );
    return;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const deployedSkills = resolveDeployedSkills(scanner.getDeployedSkills(), skillsService);

  if (deployedSkills.length === 0) {
    if (options.json) {
      jsonError('No skills deployed in current project.', 'NOT_FOUND');
      process.exit(1);
    }
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  for (const skillName of plainSkillNames) {
    const skillToRemove = deployedSkills.find((skill) => skill.name === skillName);

    if (!skillToRemove) {
      if (options.json) {
        jsonError(`'${skillName}' not found in deployed skills`, 'NOT_FOUND');
        process.exit(1);
      }
      console.log(`'${skillName}' not found in deployed skills`);
      process.exit(1);
    }
  }

  const removed = removeSkillNames(plainSkillNames, deployer, options.json);

  if (options.json) {
    jsonOutput({ removed });
  }

  cleanupGroupRefs(
    deployedSkills
      .filter((skill) => plainSkillNames.includes(skill.name))
      .map((skill) => skill.skillKey),
  );
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project (or globally with -g)')
  .argument('[name]', 'Skill name to remove')
  .option('--all', 'Remove all matching skills without prompting')
  .option('-y', 'Skip all prompts (implies --all --same-agents)')
  .option('-s, --skill <name>', 'Specific skill to remove (repeatable)', collect, [])
  .option('-g, --global', 'Remove from global agent directories')
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .option('--same-agents', 'Use currently configured agents')
  .option('--group <name>', 'Batch remove deployed skills from a group')
  .option('--from <ref>', 'Remove all skills from a collection (e.g. @alice/kit)')
  .option('--json', 'Output as JSON (implies --all)')
  .action(async (name: string | undefined, options: RemoveOptions) => {
    await executeRemove(name, options);
  });

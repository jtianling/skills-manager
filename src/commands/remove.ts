import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { fileExists, readSymlinkTarget } from '../utils/fs.js';
import { resolveTargetAgents } from '../utils/prompts.js';
import { type RemoveOptions, type ToolName, collect } from '../types.js';
import { detectArgFormat, findRepoInCentralRepository } from '../utils/repo-lookup.js';
import { extractOwnerRepo } from '../utils/source-detection.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';

function resolveSkillNames(
  name: string | undefined,
  options: RemoveOptions,
): string[] {
  const names: string[] = [];
  if (name) names.push(name);
  if (options.skill && options.skill.length > 0) {
    for (const s of options.skill) {
      if (!names.includes(s)) names.push(s);
    }
  }
  return names;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function findMatchingRepoSkills(
  ownerRepo: string,
  scanner: DeploymentScanner,
  skillsService: SkillsService,
): string[] | null {
  const repoSkills = findRepoInCentralRepository(ownerRepo, skillsService);
  if (!repoSkills) {
    return null;
  }

  const repoSkillByName = new Map(repoSkills.map((skill) => [skill.name, skill]));
  const matchedSkillNames = scanner
    .getDeployedSkills()
    .filter((deployedSkill) => {
      const repoSkill = repoSkillByName.get(deployedSkill.name);
      if (!repoSkill) {
        return false;
      }

      if (deployedSkill.deployMode === 'link') {
        const linkTarget = readSymlinkTarget(deployedSkill.path);
        if (!linkTarget) {
          return false;
        }

        return normalizePath(linkTarget) === normalizePath(repoSkill.path);
      }

      return deployedSkill.source === repoSkill.source;
    })
    .map((skill) => skill.name);

  return [...new Set(matchedSkillNames)];
}

function removeSkillNames(
  skillNames: string[],
  deployer: Deployer,
): void {
  for (const skillName of skillNames) {
    deployer.removeSkill(skillName);
    console.log(`  ✓ Removed ${skillName}`);
  }
}

function removeSkillNamesGlobal(
  skillNames: string[],
  deployer: Deployer,
  agents: ToolName[],
): boolean {
  let removed = false;

  for (const skillName of skillNames) {
    removed = deployer.removeSkillGlobal(skillName, agents) || removed;
  }

  return removed;
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
      console.log(`'${ownerRepo}' not found in central repository`);
      process.exit(1);
    }

    const allNames = [...new Set(repoSkills.map((skill) => skill.name))];
    const targetNames = explicitSkillNames.length > 0
      ? allNames.filter((n) => explicitSkillNames.includes(n))
      : allNames;

    const agents = await resolveTargetAgents(
      { agent: options.agent },
      () => [] as ToolName[],
      true,
    );
    const deployer = new Deployer(process.cwd());
    const removed = removeSkillNamesGlobal(targetNames, deployer, agents);

    if (!removed) {
      console.log(`No deployed skills found from '${ownerRepo}'`);
      process.exit(1);
    }
    return targetNames;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const matchedSkillNames = findMatchingRepoSkills(ownerRepo, scanner, skillsService);

  if (!matchedSkillNames) {
    console.log(`'${ownerRepo}' not found in central repository`);
    process.exit(1);
  }

  if (matchedSkillNames.length === 0) {
    console.log(`No deployed skills found from '${ownerRepo}'`);
    process.exit(1);
  }

  let selectedSkillNames: string[];
  if (explicitSkillNames.length > 0) {
    selectedSkillNames = matchedSkillNames.filter((n) => explicitSkillNames.includes(n));
    if (selectedSkillNames.length === 0) {
      console.log(`No matching skills from '${ownerRepo}' for: ${explicitSkillNames.join(', ')}`);
      return [];
    }
  } else if (options.all) {
    selectedSkillNames = matchedSkillNames;
  } else {
    const choices = matchedSkillNames.map((name) => ({
      name,
      value: name,
    }));
    const selected = await interactiveCheckbox({
      message: `Select skills to remove from '${ownerRepo}':`,
      choices,
    });
    if (selected.length === 0) {
      console.log('No skills selected.');
      return [];
    }
    selectedSkillNames = selected;
  }

  removeSkillNames(selectedSkillNames, deployer);
  return selectedSkillNames;
}

async function interactiveRemove(): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const deployedSkills = scanner.getDeployedSkills();

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    return;
  }

  const choices = deployedSkills.map((s) => ({
    name: s.name,
    value: s.name,
  }));
  const selected = await interactiveCheckbox({
    message: 'Select skills to remove:',
    choices,
  });

  if (selected.length === 0) {
    console.log('No skills selected.');
    return;
  }

  removeSkillNames(selected, deployer);
}

export async function executeRemove(
  name: string | undefined,
  options: RemoveOptions = {},
): Promise<void> {
  if (options.yes) {
    options.all = true;
  }

  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillNames = resolveSkillNames(name, options);

  if (skillNames.length === 0) {
    await interactiveRemove();
    return;
  }

  const ownerRepos = skillNames
    .filter((skillName) => detectArgFormat(skillName) === 'owner-repo')
    .map((skillName) => extractOwnerRepo(skillName) ?? skillName);
  let plainSkillNames = skillNames.filter((skillName) => detectArgFormat(skillName) !== 'owner-repo');

  for (const ownerRepo of ownerRepos) {
    const consumed = await removeByOwnerRepo(ownerRepo, options, plainSkillNames);
    plainSkillNames = plainSkillNames.filter((n) => !consumed.includes(n));
  }

  if (plainSkillNames.length === 0) {
    return;
  }

  if (options.global) {
    const agents = await resolveTargetAgents(
      { agent: options.agent },
      () => [] as ToolName[],
      true,
    );
    const deployer = new Deployer(process.cwd());
    for (const skillName of plainSkillNames) {
      const removed = deployer.removeSkillGlobal(skillName, agents);
      if (!removed) {
        console.log(`'${skillName}' not found in global agent directories`);
      }
    }
    return;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const deployedSkills = scanner.getDeployedSkills();

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  for (const skillName of plainSkillNames) {
    const skillToRemove = deployedSkills.find((s) => s.name === skillName);

    if (!skillToRemove) {
      console.log(`'${skillName}' not found in deployed skills`);
      process.exit(1);
    }
  }

  removeSkillNames(plainSkillNames, deployer);
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project (or globally with -g)')
  .argument('[name]', 'Skill name to remove')
  .option('--all', 'Remove all matching skills without prompting')
  .option('-s, --skill <name>', 'Specific skill to remove (repeatable)', collect, [])
  .option('-g, --global', 'Remove from global agent directories')
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .option('-y, --yes', 'Skip all prompts (equivalent to --all)')
  .action(async (name: string | undefined, options: RemoveOptions) => {
    await executeRemove(name, options);
  });

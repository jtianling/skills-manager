import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { fileExists } from '../utils/fs.js';
import { type RemoveOptions, collect } from '../types.js';

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

export async function executeRemove(
  name: string | undefined,
  options: RemoveOptions,
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillNames = resolveSkillNames(name, options);

  if (skillNames.length === 0) {
    console.log('No skill specified. Usage: skillsmgr remove <name> or skillsmgr remove -s <name>');
    process.exit(1);
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const deployedSkills = scanner.getDeployedSkills();

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  for (const skillName of skillNames) {
    const skillToRemove = deployedSkills.find((s) => s.name === skillName);

    if (!skillToRemove) {
      console.log(`'${skillName}' not found in deployed skills`);
      process.exit(1);
    }

    deployer.removeSkill(skillName);
    console.log(`  ✓ Removed ${skillName}`);
  }
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project')
  .argument('[name]', 'Skill name to remove')
  .option('-s, --skill <name>', 'Specific skill to remove (repeatable)', collect, [])
  .action(async (name: string | undefined, options: RemoveOptions) => {
    await executeRemove(name, options);
  });

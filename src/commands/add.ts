import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { AddOptions } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptSelect } from '../utils/prompts.js';
import { executeSetup } from './setup.js';

export async function executeAdd(
  name: string,
  options: AddOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    await executeSetup();
    console.log();
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const matchingSkills = skillsService.findSkillsByName(name);

  if (matchingSkills.length === 0) {
    console.log(`'${name}' not found`);
    process.exit(1);
  }

  const configuredTools = scanner.getConfiguredTools();
  if (configuredTools.length === 0) {
    console.log('No tools configured. Run: skillsmgr init');
    process.exit(1);
  }

  const deployMode = options.copy ? 'copy' : 'link';

  let skill = matchingSkills[0];
  if (matchingSkills.length > 1) {
    console.log(`Multiple skills found with name '${name}':`);
    const choices = matchingSkills.map((s, i) => ({
      name: `${i + 1}. ${s.source}/${s.name}`,
      value: s.source,
    }));
    const selectedSource = await promptSelect('Select skill:', choices);
    skill = matchingSkills.find((s) => s.source === selectedSource)!;
  }

  const existingSkills = scanner.getDeployedSkills();
  const alreadyExists = existingSkills.some((s) => s.name === skill.name);

  if (alreadyExists) {
    console.log(`  · ${skill.name} (already deployed)`);
    return;
  }

  deployer.deploySkill(skill, deployMode);
  console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
}

export const addCommand = new Command('add')
  .description('Add a skill to the project')
  .argument('<name>', 'Skill name to add')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (name: string, options: AddOptions) => {
    await executeAdd(name, options);
  });

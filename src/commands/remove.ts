import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { fileExists } from '../utils/fs.js';

export async function executeRemove(name: string): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const deployedSkills = scanner.getDeployedSkills();

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  const skillToRemove = deployedSkills.find((s) => s.name === name);

  if (!skillToRemove) {
    console.log(`'${name}' not found in deployed skills`);
    process.exit(1);
  }

  deployer.removeSkill(name);
  console.log(`  ✓ Removed ${name}`);
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project')
  .argument('<name>', 'Skill name to remove')
  .action(async (name: string) => {
    await executeRemove(name);
  });

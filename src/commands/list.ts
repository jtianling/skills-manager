import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ListOptions } from '../types.js';
import { fileExists } from '../utils/fs.js';

export async function executeList(options: ListOptions): Promise<void> {
  if (options.deployed) {
    await listDeployed();
  } else {
    await listAvailable();
  }
}

async function listAvailable(): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const service = new SkillsService(SKILLS_MANAGER_DIR);
  const skills = service.getAllSkills();

  if (skills.length === 0) {
    console.log('No skills found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropic');
    return;
  }

  console.log('Available skills in ~/.skills-manager/:\n');

  // Group by source
  const grouped: Record<string, typeof skills> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    console.log(`── ${source} (${sourceSkills.length} skill${sourceSkills.length > 1 ? 's' : ''}) ──`);
    for (const skill of sourceSkills) {
      console.log(`  ${skill.name}`);
    }
    console.log();
  }
}

async function listDeployed(): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployments = scanner.scanAllTools();

  if (deployments.length === 0) {
    console.log('No skills deployed in current project.');
    console.log('\nRun: skillsmgr init');
    return;
  }

  console.log('Deployed skills in current project:\n');

  for (const deployment of deployments) {
    const config = TOOL_CONFIGS[deployment.toolName];
    const displayName = config?.displayName || deployment.toolName;
    const dirSuffix = deployment.mode && deployment.mode !== 'all' ? ` [${deployment.mode}]` : '';

    console.log(`${displayName} (${deployment.targetDir}/)${dirSuffix}:`);

    for (const skill of deployment.skills) {
      const modeStr = skill.deployMode === 'link' ? 'link' : 'copy';
      if (skill.conflict) {
        console.log(`  ⚠ ${skill.name.padEnd(16)} (${modeStr}) ← conflict`);
      } else {
        console.log(`  ◉ ${skill.name.padEnd(16)} (${modeStr}) ← ${skill.source}`);
      }
    }
    console.log();
  }
}

export const listCommand = new Command('list')
  .description('List available or deployed skills')
  .option('--deployed', 'List deployed skills in current project')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

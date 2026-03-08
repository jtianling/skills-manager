import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { CommandsService } from '../services/commands.js';
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

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const commandsService = new CommandsService(SKILLS_MANAGER_DIR);
  const skills = skillsService.getAllSkills();
  const commands = commandsService.getAllCommands();

  if (skills.length === 0 && commands.length === 0) {
    console.log('No skills or commands found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropic');
    return;
  }

  console.log('Available in ~/.skills-manager/:\n');

  // Group skills by source
  if (skills.length > 0) {
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

  // Group commands by source
  if (commands.length > 0) {
    const grouped: Record<string, typeof commands> = {};
    for (const command of commands) {
      if (!grouped[command.source]) {
        grouped[command.source] = [];
      }
      grouped[command.source].push(command);
    }

    for (const [source, sourceCommands] of Object.entries(grouped)) {
      console.log(`── ${source} (${sourceCommands.length} command${sourceCommands.length > 1 ? 's' : ''}) ──`);
      for (const command of sourceCommands) {
        console.log(`  /${command.name}`);
      }
      console.log();
    }
  }
}

async function listDeployed(): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployments = scanner.scanAllTools();

  if (deployments.length === 0) {
    console.log('No skills or commands deployed in current project.');
    console.log('\nRun: skillsmgr init');
    return;
  }

  console.log('Deployed in current project:\n');

  for (const deployment of deployments) {
    const config = TOOL_CONFIGS[deployment.toolName];
    const displayName = config?.displayName || deployment.toolName;
    const dirSuffix = deployment.mode && deployment.mode !== 'all' ? ` [${deployment.mode}]` : '';

    if (deployment.skills.length > 0) {
      console.log(`${displayName} skills (${deployment.targetDir}/)${dirSuffix}:`);

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

    if (deployment.commands.length > 0) {
      const commandsDirDisplay = config?.commandsDir || 'commands';
      console.log(`${displayName} commands (${commandsDirDisplay}/):`);

      for (const command of deployment.commands) {
        const modeStr = command.deployMode === 'link' ? 'link' : 'copy';
        console.log(`  ◉ /${command.name.padEnd(15)} (${modeStr}) ← ${command.source}`);
      }
      console.log();
    }
  }
}

export const listCommand = new Command('list')
  .description('List available or deployed skills and commands')
  .option('--deployed', 'List deployed skills and commands in current project')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

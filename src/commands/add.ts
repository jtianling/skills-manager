import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { CommandsService } from '../services/commands.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { AddOptions, ToolName } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptSelect } from '../utils/prompts.js';

export async function executeAdd(
  name: string,
  options: AddOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const commandsService = new CommandsService(SKILLS_MANAGER_DIR);
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  // Find skill(s) or command(s) by name
  const matchingSkills = skillsService.findSkillsByName(name);
  const matchingCommands = commandsService.findCommandsByName(name);

  if (matchingSkills.length === 0 && matchingCommands.length === 0) {
    console.log(`'${name}' not found as a skill or command`);
    process.exit(1);
  }

  // Determine target tools
  let targetTools: ToolName[];
  if (options.tool) {
    if (!TOOL_CONFIGS[options.tool as ToolName]) {
      console.log(`Unknown tool: ${options.tool}`);
      process.exit(1);
    }
    targetTools = [options.tool as ToolName];
  } else {
    targetTools = scanner.getConfiguredTools();
    if (targetTools.length === 0) {
      console.log('No tools configured. Run: skillsmgr init');
      process.exit(1);
    }
  }

  const deployMode = options.copy ? 'copy' : 'link';

  // Deploy as skill if found
  if (matchingSkills.length > 0) {
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

    console.log(`Adding skill ${name} to configured tools...`);

    for (const toolName of targetTools) {
      const config = TOOL_CONFIGS[toolName];
      const deployments = scanner.scanToolDeployment(toolName, config);
      const mode = deployments.length > 0 && deployments[0].mode ? deployments[0].mode : 'all';

      const existingSkills = scanner.getDeployedSkills(toolName);
      const alreadyExists = existingSkills.some((s) => s.name === skill.name);

      if (alreadyExists) {
        console.log(`  · ${config.displayName} (already deployed)`);
        continue;
      }

      deployer.deploySkill(skill, config, deployMode, mode);

      console.log(
        `  ✓ ${config.displayName} (${deployMode === 'link' ? 'linked' : 'copied'})`
      );
    }
    return;
  }

  // Deploy as command
  let command = matchingCommands[0];
  if (matchingCommands.length > 1) {
    console.log(`Multiple commands found with name '${name}':`);
    const choices = matchingCommands.map((c, i) => ({
      name: `${i + 1}. ${c.source}/${c.name}`,
      value: c.source,
    }));
    const selectedSource = await promptSelect('Select command:', choices);
    command = matchingCommands.find((c) => c.source === selectedSource)!;
  }

  console.log(`Adding command /${name} to configured tools...`);

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName];

    if (!config.commandsDir) {
      console.log(`  · ${config.displayName} (commands not supported)`);
      continue;
    }

    const existingCommands = scanner.getDeployedCommands(toolName);
    const alreadyExists = existingCommands.some((c) => c.name === command.name);

    if (alreadyExists) {
      console.log(`  · ${config.displayName} (already deployed)`);
      continue;
    }

    deployer.deployCommand(command, config, deployMode);

    console.log(
      `  ✓ ${config.displayName} (${deployMode === 'link' ? 'linked' : 'copied'})`
    );
  }
}

export const addCommand = new Command('add')
  .description('Add a skill or command to the project')
  .argument('<name>', 'Skill or command name to add')
  .option('--tool <tool>', 'Add to specific tool only')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (name: string, options: AddOptions) => {
    await executeAdd(name, options);
  });

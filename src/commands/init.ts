import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { CommandsService } from '../services/commands.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS, getTargetDir } from '../tools/configs.js';
import { InitOptions, ToolName } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptTools, promptMode, promptSkills, promptCommands } from '../utils/prompts.js';

export async function executeInit(options: InitOptions): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const commandsService = new CommandsService(SKILLS_MANAGER_DIR);
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const allSkills = skillsService.getAllSkills();
  const allCommands = commandsService.getAllCommands();

  if (allSkills.length === 0 && allCommands.length === 0) {
    console.log('No skills or commands found. Run: skillsmgr install anthropic');
    process.exit(1);
  }

  // Get configured tools for marking in prompt
  const configuredTools = scanner.getConfiguredTools();

  // Prompt for tools
  const selectedTools = await promptTools(configuredTools);

  // For each tool, handle mode-specific if needed
  const toolModes: Record<string, string> = {};
  for (const toolName of selectedTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    if (config.supportsModeSpecific && config.availableModes) {
      const mode = await promptMode(toolName, config.availableModes);
      toolModes[toolName] = mode;
    } else {
      toolModes[toolName] = 'all';
    }
  }

  // Get currently deployed skills for each tool
  const deployedSkillNames = new Set<string>();
  for (const toolName of selectedTools) {
    const deployed = scanner.getDeployedSkills(toolName as ToolName);
    deployed.forEach((s) => deployedSkillNames.add(s.name));
  }

  // Prompt for skills (if any available)
  let selectedSkillNames: string[] = [];
  if (allSkills.length > 0) {
    selectedSkillNames = await promptSkills(
      allSkills,
      Array.from(deployedSkillNames)
    );
  }

  // Prompt for commands (if any available and tools support them)
  let selectedCommandNames: string[] = [];
  const toolsWithCommands = selectedTools.filter(
    (t) => TOOL_CONFIGS[t as ToolName].commandsDir
  );

  if (allCommands.length > 0 && toolsWithCommands.length > 0) {
    const deployedCommandNames = new Set<string>();
    for (const toolName of selectedTools) {
      const deployed = scanner.getDeployedCommands(toolName as ToolName);
      deployed.forEach((c) => deployedCommandNames.add(c.name));
    }

    selectedCommandNames = await promptCommands(
      allCommands,
      Array.from(deployedCommandNames)
    );
  }

  if (selectedSkillNames.length === 0 && selectedCommandNames.length === 0) {
    console.log('No skills or commands selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const selectedCommands = commandsService.getCommandsByNames(selectedCommandNames);
  const deployMode = options.copy ? 'copy' : 'link';

  console.log('\nDeploying...\n');

  // Deploy to each tool
  for (const toolName of selectedTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const mode = toolModes[toolName];
    const targetDir = getTargetDir(config, mode);

    console.log(`${config.displayName}:`);

    // --- Deploy skills ---
    if (selectedSkills.length > 0) {
      const previouslyDeployed = scanner.getDeployedSkills(toolName as ToolName);
      const previousNames = new Set(previouslyDeployed.map((s) => s.name));

      const toAdd = selectedSkills.filter((s) => !previousNames.has(s.name));
      const toKeep = selectedSkills.filter((s) => previousNames.has(s.name));
      const toRemove = previouslyDeployed.filter(
        (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
      );
      const unmanagedSkills = previouslyDeployed.filter(
        (s) => s.source === 'unknown'
      );

      for (const skill of toRemove) {
        deployer.removeSkill(skill.name, config, mode);
        console.log(`  ✗ ${skill.name} (removed)`);
      }

      for (const skill of toKeep) {
        console.log(`  · ${skill.name} (unchanged)`);
      }

      for (const skill of toAdd) {
        deployer.deploySkill(skill, config, deployMode, mode);
        console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
      }

      for (const skill of unmanagedSkills) {
        console.log(`  ~ ${skill.name} (unmanaged)`);
      }
    }

    // --- Deploy commands ---
    if (config.commandsDir && selectedCommands.length > 0) {
      const previouslyDeployed = scanner.getDeployedCommands(toolName as ToolName);
      const previousNames = new Set(previouslyDeployed.map((c) => c.name));

      const toAdd = selectedCommands.filter((c) => !previousNames.has(c.name));
      const toKeep = selectedCommands.filter((c) => previousNames.has(c.name));
      const toRemove = previouslyDeployed.filter(
        (c) => !selectedCommandNames.includes(c.name) && c.source !== 'unknown'
      );
      const unmanagedCommands = previouslyDeployed.filter(
        (c) => c.source === 'unknown'
      );

      for (const cmd of toRemove) {
        deployer.removeCommand(cmd.name, config);
        console.log(`  ✗ /${cmd.name} (removed)`);
      }

      for (const cmd of toKeep) {
        console.log(`  · /${cmd.name} (unchanged)`);
      }

      for (const cmd of toAdd) {
        deployer.deployCommand(cmd, config, deployMode);
        console.log(`  ✓ /${cmd.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
      }

      for (const cmd of unmanagedCommands) {
        console.log(`  ~ /${cmd.name} (unmanaged)`);
      }
    }

    console.log();
  }

  const parts: string[] = [];
  if (selectedSkillNames.length > 0) parts.push(`${selectedSkillNames.length} skills`);
  if (selectedCommandNames.length > 0) parts.push(`${selectedCommandNames.length} commands`);

  console.log(
    `Done! Deployed ${parts.join(' and ')} to ${selectedTools.length} tool${selectedTools.length > 1 ? 's' : ''}.`
  );
}

export const initCommand = new Command('init')
  .description('Deploy skills and commands to current project')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (options: InitOptions) => {
    await executeInit(options);
  });

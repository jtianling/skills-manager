import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { RemoveOptions, ToolName } from '../types.js';

export async function executeRemove(
  skillName: string,
  options: RemoveOptions
): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const configuredTools = scanner.getConfiguredTools();

  if (configuredTools.length === 0) {
    console.log('No skills deployed in current project.');
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
    targetTools = configuredTools;
  }

  console.log(`Removing ${skillName}...`);

  let removed = false;

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName];
    const deployments = scanner.scanToolDeployment(toolName, config);

    for (const deployment of deployments) {
      const skillToRemove = deployment.skills.find((s) => s.name === skillName);
      if (!skillToRemove) continue;

      const mode = deployment.mode || 'all';
      deployer.removeSkill(skillName, config, mode);

      console.log(`  ✓ Removed from ${config.displayName}`);
      removed = true;
    }
  }

  if (!removed) {
    console.log(`Skill '${skillName}' not found in any configured tool`);
  }
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project')
  .argument('<skill>', 'Skill name to remove')
  .option('--tool <tool>', 'Remove from specific tool only')
  .action(async (skill: string, options: RemoveOptions) => {
    await executeRemove(skill, options);
  });

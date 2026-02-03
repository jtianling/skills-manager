import { Command } from 'commander';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { RemoveOptions, ToolName } from '../types.js';

export async function executeRemove(
  skillName: string,
  options: RemoveOptions
): Promise<void> {
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  if (!metadataService.hasMetadata()) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  // Determine target tools
  let targetTools: string[];
  if (options.tool) {
    if (!TOOL_CONFIGS[options.tool as ToolName]) {
      console.log(`Unknown tool: ${options.tool}`);
      process.exit(1);
    }
    targetTools = [options.tool];
  } else {
    targetTools = metadataService.getConfiguredTools();
  }

  console.log(`Removing ${skillName}...`);

  let removed = false;

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    if (!deployment) continue;

    const existingSkills = deployment.skills;
    const skillToRemove = existingSkills.find((s) => s.name === skillName);

    if (!skillToRemove) continue;

    deployer.removeSkill(skillName, config, deployment.mode);

    // Update metadata
    const remainingSkills = existingSkills.filter((s) => s.name !== skillName);
    metadataService.updateDeployment(toolName, remainingSkills);

    console.log(`  ✓ Removed from ${config.displayName}`);
    removed = true;
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

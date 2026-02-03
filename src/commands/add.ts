import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { AddOptions, ToolName, DeployedSkill } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptSelect } from '../utils/prompts.js';

export async function executeAdd(
  skillName: string,
  options: AddOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  // Find skill(s) by name
  const matchingSkills = skillsService.findSkillsByName(skillName);

  if (matchingSkills.length === 0) {
    console.log(`Skill '${skillName}' not found`);
    process.exit(1);
  }

  // If multiple matches, prompt for selection
  let skill = matchingSkills[0];
  if (matchingSkills.length > 1) {
    console.log(`Multiple skills found with name '${skillName}':`);
    const choices = matchingSkills.map((s, i) => ({
      name: `${i + 1}. ${s.source}/${s.name}`,
      value: s.source,
    }));
    const selectedSource = await promptSelect('Select skill:', choices);
    skill = matchingSkills.find((s) => s.source === selectedSource)!;
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
    // Use configured tools from metadata
    targetTools = metadataService.getConfiguredTools();
    if (targetTools.length === 0) {
      console.log('No tools configured. Run: skillsmgr init');
      process.exit(1);
    }
  }

  const deployMode = options.copy ? 'copy' : 'link';

  console.log(`Adding ${skillName} to configured tools...`);

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    const mode = deployment?.mode || 'all';

    deployer.deploySkill(skill, config, deployMode, mode);

    // Update metadata
    const existingSkills = metadataService.getDeployedSkills(toolName);
    const alreadyExists = existingSkills.some((s) => s.name === skill.name);

    if (!alreadyExists) {
      const newSkill: DeployedSkill = {
        name: skill.name,
        source: skill.source,
        deployMode,
      };
      metadataService.updateDeployment(toolName, [...existingSkills, newSkill]);
    }

    console.log(
      `  ✓ ${config.displayName} (${deployMode === 'link' ? 'linked' : 'copied'})`
    );
  }
}

export const addCommand = new Command('add')
  .description('Add a skill to the project')
  .argument('<skill>', 'Skill name to add')
  .option('--tool <tool>', 'Add to specific tool only')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (skill: string, options: AddOptions) => {
    await executeAdd(skill, options);
  });

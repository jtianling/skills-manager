import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { AddOptions, ToolName } from '../types.js';
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
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
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
  let targetTools: ToolName[];
  if (options.tool) {
    if (!TOOL_CONFIGS[options.tool as ToolName]) {
      console.log(`Unknown tool: ${options.tool}`);
      process.exit(1);
    }
    targetTools = [options.tool as ToolName];
  } else {
    // Use configured tools from scanner
    targetTools = scanner.getConfiguredTools();
    if (targetTools.length === 0) {
      console.log('No tools configured. Run: skillsmgr init');
      process.exit(1);
    }
  }

  const deployMode = options.copy ? 'copy' : 'link';

  console.log(`Adding ${skillName} to configured tools...`);

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName];
    const deployments = scanner.scanToolDeployment(toolName, config);
    // Use 'all' mode if no specific mode found
    const mode = deployments.length > 0 && deployments[0].mode ? deployments[0].mode : 'all';

    // Check if skill already exists
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
}

export const addCommand = new Command('add')
  .description('Add a skill to the project')
  .argument('<skill>', 'Skill name to add')
  .option('--tool <tool>', 'Add to specific tool only')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (skill: string, options: AddOptions) => {
    await executeAdd(skill, options);
  });

import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS, getTargetDir } from '../tools/configs.js';
import { InitOptions, ToolName, DeployedSkill } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptTools, promptMode, promptSkills } from '../utils/prompts.js';

export async function executeInit(options: InitOptions): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  const allSkills = skillsService.getAllSkills();

  if (allSkills.length === 0) {
    console.log('No skills found. Run: skillsmgr install anthropic');
    process.exit(1);
  }

  // Get configured tools for marking in prompt
  const configuredTools = metadataService.getConfiguredTools();

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
    const deployed = metadataService.getDeployedSkills(toolName);
    deployed.forEach((s) => deployedSkillNames.add(s.name));
  }

  // Prompt for skills
  const selectedSkillNames = await promptSkills(
    allSkills,
    Array.from(deployedSkillNames)
  );

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const deployMode = options.copy ? 'copy' : 'link';

  console.log('\nDeploying skills...\n');

  // Deploy to each tool
  for (const toolName of selectedTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const mode = toolModes[toolName];
    const targetDir = getTargetDir(config, mode);

    console.log(`${config.displayName}:`);

    // Get previously deployed skills
    const previouslyDeployed = metadataService.getDeployedSkills(toolName);
    const previousNames = new Set(previouslyDeployed.map((s) => s.name));

    // Determine changes
    const toAdd = selectedSkills.filter((s) => !previousNames.has(s.name));
    const toKeep = selectedSkills.filter((s) => previousNames.has(s.name));
    const toRemove = previouslyDeployed.filter(
      (s) => !selectedSkillNames.includes(s.name)
    );

    // Remove skills no longer selected
    for (const skill of toRemove) {
      deployer.removeSkill(skill.name, config, mode);
      console.log(`  ✗ ${skill.name} (removed)`);
    }

    // Keep unchanged skills
    for (const skill of toKeep) {
      console.log(`  · ${skill.name} (unchanged)`);
    }

    // Add new skills
    for (const skill of toAdd) {
      deployer.deploySkill(skill, config, deployMode, mode);
      console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
    }

    // Update metadata
    const newDeployedSkills: DeployedSkill[] = selectedSkills.map((skill) => ({
      name: skill.name,
      source: skill.source,
      deployMode,
    }));

    metadataService.addDeployment(toolName, targetDir, mode, newDeployedSkills);

    console.log();
  }

  console.log(
    `Done! Deployed ${selectedSkillNames.length} skills to ${selectedTools.length} tool${selectedTools.length > 1 ? 's' : ''}.`
  );
}

export const initCommand = new Command('init')
  .description('Deploy skills to current project')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (options: InitOptions) => {
    await executeInit(options);
  });

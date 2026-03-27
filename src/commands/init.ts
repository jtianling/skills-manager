import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { InitOptions, ToolName } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptAgents, promptSkills } from '../utils/prompts.js';
import { executeSetup } from './setup.js';

export async function executeInit(options: InitOptions): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    await executeSetup();
    console.log();
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const allSkills = skillsService.getAllSkills();

  if (allSkills.length === 0) {
    console.log('No skills found. Run: skillsmgr install anthropic');
    process.exit(1);
  }

  const configuredTools = scanner.getConfiguredTools();

  const selectedTools = await promptAgents(configuredTools);

  const agentsSelected = selectedTools.includes('agents-skills-standard');
  const selectedNonNativeTools = selectedTools.filter((t) => t !== 'agents-skills-standard');

  if (!agentsSelected) {
    console.log('\nAgents Skills Standard not selected — skipping skills deployment.');
    console.log('Existing skills in .agents/skills/ are preserved.\n');

    // Only remove symlink bridges for deselected non-native tools
    for (const toolName of configuredTools) {
      const config = TOOL_CONFIGS[toolName];
      if (config.native) continue;
      if (selectedNonNativeTools.includes(toolName)) continue;

      const removed = deployer.removeSymlinkBridge(config);
      if (removed) {
        console.log(`${config.displayName}: symlink removed`);
      }
    }

    console.log('Done!');
    return;
  }

  const deployedSkills = scanner.getDeployedSkills();
  const deployedSkillNames = deployedSkills.map((s) => s.name);

  const selectedSkillNames = await promptSkills(allSkills, deployedSkillNames);

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const deployMode = options.copy ? 'copy' : 'link';

  console.log('\nDeploying...\n');

  // Deploy skills to .agents/skills/
  const previousNames = new Set(deployedSkills.map((s) => s.name));
  const toAdd = selectedSkills.filter((s) => !previousNames.has(s.name));
  const toKeep = selectedSkills.filter((s) => previousNames.has(s.name));
  const toRemove = deployedSkills.filter(
    (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
  );
  const unmanagedSkills = deployedSkills.filter((s) => s.source === 'unknown');

  console.log('Skills (.agents/skills/):');

  for (const skill of toRemove) {
    deployer.removeSkill(skill.name);
    console.log(`  ✗ ${skill.name} (removed)`);
  }

  for (const skill of toKeep) {
    console.log(`  · ${skill.name} (unchanged)`);
  }

  for (const skill of toAdd) {
    deployer.deploySkill(skill, deployMode);
    console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
  }

  for (const skill of unmanagedSkills) {
    console.log(`  ~ ${skill.name} (unmanaged)`);
  }

  console.log();

  // Handle symlink bridges
  for (const toolName of selectedNonNativeTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    if (!config || config.native) continue;

    const created = deployer.createSymlinkBridge(config);
    if (created) {
      console.log(`${config.displayName}: symlink ${config.symlinkDir} → .agents/skills`);
    } else if (deployer.isSymlinkBridgeActive(config)) {
      console.log(`${config.displayName}: symlink already active`);
    }
  }

  // Remove symlink bridges for deselected non-native tools
  for (const toolName of configuredTools) {
    const config = TOOL_CONFIGS[toolName];
    if (config.native) continue;
    if (selectedNonNativeTools.includes(toolName)) continue;

    const removed = deployer.removeSymlinkBridge(config);
    if (removed) {
      console.log(`${config.displayName}: symlink removed`);
    }
  }

  console.log(
    `\nDone! Deployed ${selectedSkillNames.length} skills.`
  );
}

export const initCommand = new Command('init')
  .description('Deploy skills to current project')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (options: InitOptions) => {
    await executeInit(options);
  });

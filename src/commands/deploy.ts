import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { GroupsService } from '../services/groups.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { DeployOptions, ToolName } from '../types.js';
import {
  loadGroupsData,
  promptAgents,
  promptAgentsGlobal,
  promptSkills,
} from '../utils/prompts.js';
import { ensureSetup } from './setup.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';

function scanGlobalDeployedSkills(agents: ToolName[]): string[] {
  const names = new Set<string>();
  for (const agentName of agents) {
    const dir = TOOL_CONFIGS[agentName].globalSkillsDir;
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (existsSync(join(dir, entry.name, 'SKILL.md'))) {
          names.add(entry.name);
        }
      }
    } catch {
      // directory not readable
    }
  }
  return [...names];
}

async function executeDeployGlobal(
  skillsService: SkillsService,
  deployer: Deployer,
  options: DeployOptions,
): Promise<void> {
  const selectedAgents = await promptAgentsGlobal() as ToolName[];

  if (selectedAgents.length === 0) {
    console.log('No agents selected');
    return;
  }

  const deployedGlobalNames = scanGlobalDeployedSkills(selectedAgents);

  const allSkills = skillsService.getAllSkills();
  const groupsData = loadGroupsData(new GroupsService());
  const selectedSkillNames = await promptSkills(allSkills, deployedGlobalNames, groupsData);

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const deployMode = options.copy ? 'copy' : 'link';

  console.log('\nDeploying globally...\n');

  for (const skill of selectedSkills) {
    deployer.deploySkillGlobal(skill, selectedAgents, deployMode);
  }

  console.log(
    `\nDone! Deployed ${selectedSkillNames.length} skills globally to ${selectedAgents.length} agents.`
  );
}

export async function executeDeploy(options: DeployOptions): Promise<void> {
  await ensureSetup();

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const allSkills = skillsService.getAllSkills();

  if (allSkills.length === 0) {
    if (options.json) {
      jsonError('No skills found. Run: skillsmgr install anthropics/skills', 'NO_SKILLS');
      process.exit(1);
    }
    console.log('No skills found. Run: skillsmgr install anthropics/skills');
    process.exit(1);
  }

  if (options.global) {
    await executeDeployGlobal(skillsService, deployer, options);
    return;
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
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
  const groupsData = loadGroupsData(new GroupsService());

  const selectedSkillNames = await promptSkills(allSkills, deployedSkillNames, groupsData);

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const deployMode = options.copy ? 'copy' : 'link';

  if (!options.json) {
    console.log('\nDeploying...\n');
  }

  // Deploy skills to .agents/skills/
  const previousNames = new Set(deployedSkills.map((s) => s.name));
  const toAdd = selectedSkills.filter((s) => !previousNames.has(s.name));
  const toKeep = selectedSkills.filter((s) => previousNames.has(s.name));
  const toRemove = deployedSkills.filter(
    (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
  );
  const unmanagedSkills = deployedSkills.filter((s) => s.source === 'unknown');

  // Perform all deploy operations
  for (const skill of toRemove) {
    deployer.removeSkill(skill.name);
  }

  for (const skill of toAdd) {
    deployer.deploySkill(skill, deployMode);
  }

  if (options.json) {
    const deployed: Array<{ name: string; agents: string[]; mode: string }> = [];
    for (const skill of toAdd) {
      deployed.push({ name: skill.name, agents: selectedTools, mode: deployMode === 'link' ? 'linked' : 'copied' });
    }
    for (const skill of toKeep) {
      deployed.push({ name: skill.name, agents: selectedTools, mode: 'unchanged' });
    }
    jsonOutput({ deployed });
    return;
  }

  // Human output
  console.log('Skills (.agents/skills/):');

  for (const skill of toRemove) {
    console.log(`  ✗ ${skill.name} (removed)`);
  }

  for (const skill of toKeep) {
    console.log(`  · ${skill.name} (unchanged)`);
  }

  for (const skill of toAdd) {
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

export const deployCommand = new Command('deploy')
  .description('Deploy skills to current project (or globally with -g)')
  .option('--copy', 'Copy files instead of creating symlinks')
  .option('-g, --global', 'Deploy skills globally to agent user-level directories')
  .option('--json', 'Output as JSON')
  .action(async (options: DeployOptions) => {
    await executeDeploy(options);
  });

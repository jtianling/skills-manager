import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { GroupsService } from '../services/groups.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import {
  DeploymentManifest,
  DeploymentManifestService,
  skillToKey,
} from '../services/deployment-manifest.js';
import { DeploymentsRegistryService } from '../services/deployments-registry.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { DeployOptions, SkillInfo, ToolName, collect } from '../types.js';
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
  if (options.refresh) {
    await ensureSetup();
    await executeDeployRefresh(options);
    return;
  }

  if (options.json || options.y) {
    if (!options.all) options.all = true;
    if (!options.agent?.length && !options.sameAgents) options.sameAgents = true;
  }

  await ensureSetup();

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const groupsService = new GroupsService();
  const manifestService = new DeploymentManifestService();

  const followGroupNames = options.followGroup ?? [];
  if (followGroupNames.length > 0) {
    const existingGroups = new Set(groupsService.listGroups());
    for (const name of followGroupNames) {
      if (!existingGroups.has(name)) {
        const msg = `Unknown group: ${name}.  Run \`skillsmgr group list\` to see available groups.`;
        if (options.json) {
          jsonError(msg, 'UNKNOWN_GROUP');
        } else {
          console.error(`Error: ${msg}`);
        }
        process.exit(1);
      }
    }
  }

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

  const selectedTools = options.sameAgents
    ? configuredTools
    : options.agent && options.agent.length > 0
      ? options.agent as ToolName[]
      : await promptAgents(configuredTools);

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
  const groupsData = loadGroupsData(groupsService);

  const followKeys = new Set<string>();
  const followSkills: SkillInfo[] = [];
  for (const groupName of followGroupNames) {
    const members = groupsService.getGroup(groupName)
      ? groupsService.getGroupMembers(groupName)
      : [];
    for (const key of members) {
      followKeys.add(key);
    }
  }
  for (const skill of allSkills) {
    if (followKeys.has(skillToKey(skill))) {
      followSkills.push(skill);
    }
  }
  const followNames = new Set(followSkills.map((s) => s.name));
  const promptableSkills = allSkills.filter((s) => !followNames.has(s.name));

  const promptedNames = options.all
    ? promptableSkills.map((s) => s.name)
    : await promptSkills(promptableSkills, deployedSkillNames, groupsData);

  if (promptedNames.length === 0 && followSkills.length === 0) {
    console.log('No skills selected');
    return;
  }

  const promptedSkills = skillsService.getSkillsByNames(promptedNames);
  const seenKey = new Set<string>();
  const selectedSkills: SkillInfo[] = [];
  for (const skill of [...followSkills, ...promptedSkills]) {
    const key = skillToKey(skill);
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    selectedSkills.push(skill);
  }
  const selectedSkillNames = selectedSkills.map((s) => s.name);
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

  writeProjectManifest({
    manifestService,
    deployMode,
    followGroupNames,
    pinnedSkills: promptedSkills.map(skillToKey),
  });

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

interface WriteManifestArgs {
  manifestService: DeploymentManifestService;
  deployMode: 'link' | 'copy';
  followGroupNames: string[];
  pinnedSkills: string[];
}

function writeProjectManifest(args: WriteManifestArgs): void {
  const projectRoot = process.cwd();
  let prev: DeploymentManifest | null = null;
  try {
    prev = args.manifestService.readManifest(projectRoot);
  } catch (e) {
    console.warn(`⚠ ${(e as Error).message}`);
  }
  const merged = args.manifestService.mergeForDeploy(prev, {
    mode: args.deployMode,
    followGroups: args.followGroupNames,
    pinnedSkills: args.pinnedSkills,
  });
  try {
    args.manifestService.writeManifest(projectRoot, merged);
  } catch (e) {
    console.warn(`⚠ Failed to write deployment manifest: ${(e as Error).message}`);
  }

  try {
    new DeploymentsRegistryService().recordDeploy(projectRoot, {
      mode: merged.mode,
      followGroups: merged.followGroups,
      pinnedSkills: merged.pinnedSkills,
      lastDeployedAt: merged.deployedAt,
    });
  } catch (e) {
    console.warn(`⚠ Failed to update global deployments registry: ${(e as Error).message}`);
  }
}

async function executeDeployRefresh(options: DeployOptions): Promise<void> {
  const projectRoot = process.cwd();
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const groupsService = new GroupsService();
  const manifestService = new DeploymentManifestService();
  const deployer = new Deployer(projectRoot);
  const scanner = new DeploymentScanner(projectRoot, SKILLS_MANAGER_DIR);

  let manifest: DeploymentManifest | null;
  try {
    manifest = manifestService.readManifest(projectRoot);
  } catch (e) {
    const msg = (e as Error).message;
    if (options.json) {
      jsonError(msg, 'INVALID_MANIFEST');
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }

  if (!manifest) {
    const msg = `No deployment manifest found at ${join(projectRoot, '.skills-manager', 'deployment.json')}.  Run \`skillsmgr deploy\` first to create one.`;
    if (options.json) {
      jsonError(msg, 'NO_MANIFEST');
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(1);
  }

  const resolved = manifestService.resolveExpectedSkills(manifest, groupsService, skillsService);
  for (const warning of resolved.warnings) {
    console.warn(`⚠ ${warning}`);
  }

  const deployedSkills = scanner.getDeployedSkills();
  const expectedNames = new Set(resolved.skills.map((s) => s.name));
  const currentNames = new Set(deployedSkills.map((s) => s.name));

  const toAdd = resolved.skills.filter((s) => !currentNames.has(s.name));
  const toKeep = resolved.skills.filter((s) => currentNames.has(s.name));
  const toRemove = deployedSkills.filter(
    (s) => !expectedNames.has(s.name) && s.source !== 'unknown',
  );

  for (const skill of toRemove) {
    deployer.removeSkill(skill.name);
  }
  for (const skill of toAdd) {
    deployer.deploySkill(skill, manifest.mode);
  }

  const refreshedAt = new Date().toISOString();
  const refreshedManifest = {
    ...manifest,
    deployedAt: refreshedAt,
  };
  manifestService.writeManifest(projectRoot, refreshedManifest);

  try {
    new DeploymentsRegistryService().recordDeploy(projectRoot, {
      mode: refreshedManifest.mode,
      followGroups: refreshedManifest.followGroups,
      pinnedSkills: refreshedManifest.pinnedSkills,
      lastDeployedAt: refreshedAt,
    });
  } catch (e) {
    console.warn(`⚠ Failed to update global deployments registry: ${(e as Error).message}`);
  }

  if (options.json) {
    jsonOutput({
      refreshed: {
        added: toAdd.map((s) => s.name),
        kept: toKeep.map((s) => s.name),
        removed: toRemove.map((s) => s.name),
        warnings: resolved.warnings,
      },
    });
    return;
  }

  console.log(
    `Refreshed: +${toAdd.length} ·${toKeep.length} (kept) -${toRemove.length}`,
  );
  for (const s of toAdd) console.log(`  ✓ ${s.name} (added)`);
  for (const s of toRemove) console.log(`  ✗ ${s.name} (removed)`);
}

export const deployCommand = new Command('deploy')
  .description('Deploy skills to current project (or globally with -g)')
  .option('--copy', 'Copy files instead of creating symlinks')
  .option('-g, --global', 'Deploy skills globally to agent user-level directories')
  .option('--all', 'Deploy all skills without prompting')
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .option('--same-agents', 'Use currently configured agents')
  .option('-y', 'Skip all prompts (implies --all --same-agents)')
  .option('--json', 'Output as JSON (implies --all)')
  .option('--follow-group <name>', 'Follow a group: deploy its current members and re-sync on refresh (repeatable)', collect, [])
  .option('--refresh', 'Re-align deployed skills to the project manifest (no prompts)')
  .action(async (options: DeployOptions) => {
    await executeDeploy(options);
  });

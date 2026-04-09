import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { GroupsService } from '../services/groups.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { rollbackInstall } from '../services/rollback.js';
import { installSource } from './install.js';
import { AddOptions, SkillInfo, ToolName, collect } from '../types.js';
import {
  buildSourceGroupedChoices,
  loadGroupsData,
  resolveTargetAgents,
  type VirtualGroupsData,
} from '../utils/prompts.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { resolveSkillByName } from '../utils/skill-resolve.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ensureSetup } from './setup.js';
import { detectArgFormat, findRepoInCentralRepository } from '../utils/repo-lookup.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';
import { readManifest } from '../services/manifest.js';
import { parseDependencyIdentifier } from '../services/dependency.js';

async function promptSkillsFromRepo(
  repoSkills: SkillInfo[],
  deployedSkillNames: string[],
  groupsData?: VirtualGroupsData,
): Promise<string[]> {
  const choices = buildSourceGroupedChoices(repoSkills, groupsData ?? {}, {
    getChecked: (skill) => deployedSkillNames.includes(skill.name) ? true : undefined,
    getLocked: (skill) => deployedSkillNames.includes(skill.name) ? true : undefined,
    getSuffix: (skill) => deployedSkillNames.includes(skill.name)
      ? '[deployed]'
      : undefined,
  });

  return interactiveCheckbox({
    message: 'Select skills to add (use deploy/remove to remove):',
    choices,
    pageSize: 15,
  });
}

async function deploySkills(
  skillNames: string[],
  skillsService: SkillsService,
  deployer: Deployer,
  scanner: DeploymentScanner,
  deployMode: 'link' | 'copy',
  json?: boolean,
): Promise<Array<{ name: string; mode: string }>> {
  const deployedSkills = scanner.getDeployedSkills();
  const deployedNames = new Set(deployedSkills.map((s) => s.name));
  const results: Array<{ name: string; mode: string }> = [];

  for (const name of skillNames) {
    if (deployedNames.has(name)) continue;

    const skill = skillsService.getSkillByName(name);
    if (!skill) {
      if (!json) console.log(`  ⚠ ${name} (not found in central repository)`);
      continue;
    }

    deployer.deploySkill(skill, deployMode);
    results.push({ name: skill.name, mode: deployMode === 'link' ? 'linked' : 'copied' });
    if (!json) console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);

    // Deploy dependencies
    const depResults = await deployDependencies(
      skill.path, skillsService, deployer, scanner, deployMode, json,
    );
    results.push(...depResults);
  }

  return results;
}

async function deployDependencies(
  skillPath: string,
  skillsService: SkillsService,
  deployer: Deployer,
  scanner: DeploymentScanner,
  deployMode: 'link' | 'copy',
  json?: boolean,
  visited: Set<string> = new Set(),
): Promise<Array<{ name: string; mode: string }>> {
  const manifest = readManifest(skillPath);
  if (!manifest?.dependencies || manifest.dependencies.length === 0) return [];

  const deployedNames = new Set(scanner.getDeployedSkills().map((s) => s.name));
  const results: Array<{ name: string; mode: string }> = [];
  const missing: string[] = [];

  for (const dep of manifest.dependencies) {
    const parsed = parseDependencyIdentifier(dep);
    const depName = parsed.type === 'registry'
      ? parsed.packageName
      : parsed.type === 'github-skill'
        ? parsed.skillName
        : `${parsed.owner}/${parsed.repo}`;

    if (visited.has(dep) || deployedNames.has(depName)) continue;
    visited.add(dep);

    const skill = skillsService.getSkillByName(depName);

    if (!skill) {
      missing.push(dep);
      continue;
    }

    if (!deployedNames.has(skill.name)) {
      deployer.deploySkill(skill, deployMode);
      deployedNames.add(skill.name);
      results.push({ name: skill.name, mode: deployMode === 'link' ? 'linked' : 'copied' });
      if (!json) console.log(`  ✓ ${skill.name} (dependency, ${deployMode === 'link' ? 'linked' : 'copied'})`);
    }

    // Recurse into dependency's dependencies
    const subResults = await deployDependencies(
      skill.path, skillsService, deployer, scanner, deployMode, json, visited,
    );
    results.push(...subResults);
  }

  if (missing.length > 0 && !json) {
    console.log(`\n  Dependencies not installed: ${missing.join(', ')}`);
    console.log(`  Run: skillsmgr install <source> to install them first.`);
  }

  return results;
}

async function deploySkillsGlobal(
  skillNames: string[],
  skillsService: SkillsService,
  deployer: Deployer,
  agents: ToolName[],
  deployMode: 'link' | 'copy',
  json?: boolean,
): Promise<Array<{ name: string; mode: string }>> {
  const results: Array<{ name: string; mode: string }> = [];

  for (const name of skillNames) {
    const skill = skillsService.getSkillByName(name);
    if (!skill) {
      if (!json) console.log(`  ⚠ ${name} (not found in central repository)`);
      continue;
    }

    deployer.deploySkillGlobal(skill, agents, deployMode);
    results.push({ name: skill.name, mode: deployMode === 'link' ? 'linked' : 'copied' });
  }

  return results;
}

function ensureSymlinkBridges(
  selectedAgents: string[],
  deployer: Deployer,
): void {
  const agentsSelected = selectedAgents.includes('agents-skills-standard');
  const nonNativeAgents = selectedAgents.filter((t) => t !== 'agents-skills-standard');

  if (!agentsSelected && nonNativeAgents.length === 0) return;

  const processedDirs = new Set<string>();
  for (const agentName of nonNativeAgents) {
    const config = TOOL_CONFIGS[agentName as keyof typeof TOOL_CONFIGS];
    if (!config || config.native || !config.symlinkDir) continue;
    if (processedDirs.has(config.symlinkDir)) continue;
    processedDirs.add(config.symlinkDir);

    const created = deployer.createSymlinkBridge(config);
    if (created) {
      console.log(`${config.displayName}: symlink ${config.symlinkDir} → .agents/skills`);
    }
  }
}

async function handleSkillName(
  name: string,
  options: AddOptions,
  skillsService: SkillsService,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  const allSkills = skillsService.getAllSkills();
  const skill = await resolveSkillByName(name, allSkills);

  if (!skill) {
    await handleRemoteInstallAndDeploy(name, options, scanner, deployer);
    return;
  }

  if (options.global) {
    const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools(), true);
    const deployMode = options.copy ? 'copy' : 'link';
    deployer.deploySkillGlobal(skill, selectedAgents, deployMode);
    return;
  }

  const existingSkills = scanner.getDeployedSkills();
  const alreadyExists = existingSkills.some((s) => s.name === skill.name);

  if (alreadyExists) {
    if (!options.json) console.log(`  · ${skill.name} (already deployed)`);
    return;
  }

  const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  const deployMode = options.copy ? 'copy' : 'link';

  deployer.deploySkill(skill, deployMode);
  if (!options.json) {
    console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
  }

  // Deploy dependencies
  const depResults = await deployDependencies(
    skill.path, skillsService, deployer, scanner, deployMode, options.json,
  );

  if (options.json) {
    const allDeployed = [
      { name: skill.name, agents: selectedAgents, mode: deployMode === 'link' ? 'linked' : 'copied' },
      ...depResults.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
    ];
    jsonOutput({ deployed: allDeployed });
  }

  ensureSymlinkBridges(selectedAgents, deployer);
}

async function handleOwnerRepo(
  ownerRepo: string,
  options: AddOptions,
  skillsService: SkillsService,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  const repoSkills = findRepoInCentralRepository(ownerRepo, skillsService);

  if (repoSkills) {
    await handleRepoSkillSelection(repoSkills, options, skillsService, scanner, deployer);
    return;
  }

  // Not found in central repo — install from remote
  await handleRemoteInstallAndDeploy(ownerRepo, options, scanner, deployer);
}

async function handleUrl(
  url: string,
  options: AddOptions,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  await handleRemoteInstallAndDeploy(url, options, scanner, deployer);
}

function filterSkillsByFlag(
  repoSkills: SkillInfo[],
  skillFilter: string[],
): string[] {
  for (const name of skillFilter) {
    if (!repoSkills.some((s) => s.name === name)) {
      console.log(`Skill '${name}' not found.`);
      process.exit(1);
    }
  }
  return skillFilter;
}

async function handleRepoSkillSelection(
  repoSkills: SkillInfo[],
  options: AddOptions,
  skillsService: SkillsService,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);
  const allDeployed = repoSkills.every((s) => deployedNames.includes(s.name));

  if (allDeployed && !options.global) {
    if (!options.json) console.log('All skills from this source are already deployed.');
    return;
  }

  const selectedAgents = await resolveTargetAgents(
    options,
    () => scanner.getConfiguredTools(),
    options.global,
  );

  const groupsData = loadGroupsData(new GroupsService());
  const selectedNames = (options.skill && options.skill.length > 0)
    ? filterSkillsByFlag(repoSkills, options.skill)
    : options.all
      ? repoSkills.map((s) => s.name)
      : await promptSkillsFromRepo(repoSkills, options.global ? [] : deployedNames, groupsData);
  const newSkills = options.global
    ? selectedNames
    : selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    if (!options.json) console.log('No new skills selected.');
    return;
  }

  const deployMode = options.copy ? 'copy' : 'link';

  if (options.global) {
    const results = await deploySkillsGlobal(newSkills, skillsService, deployer, selectedAgents, deployMode, options.json);
    if (options.json) {
      jsonOutput({
        deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
      });
    }
    return;
  }

  const results = await deploySkills(newSkills, skillsService, deployer, scanner, deployMode, options.json);
  if (options.json) {
    jsonOutput({
      deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
    });
    return;
  }
  ensureSymlinkBridges(selectedAgents, deployer);
}

async function handleRemoteInstallAndDeploy(
  source: string,
  options: AddOptions,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  let installResult;
  try {
    installResult = await installSource(source, {
      all: !(options.skill && options.skill.length > 0),
      skill: options.skill,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (options.json) {
        jsonError(error.message, 'INSTALL_ERROR');
      } else {
        console.error(`Error: ${error.message}`);
      }
    }
    process.exit(1);
  }

  const rollback = () => rollbackInstall(
    installResult.basePath,
    installResult.sourceKey,
    installResult.installedPaths,
    installResult.sourceKeys,
  );

  let selectedAgents: ToolName[];
  try {
    selectedAgents = await resolveTargetAgents(
      options,
      () => scanner.getConfiguredTools(),
      options.global,
    );
  } catch {
    rollback();
    return;
  }

  // Re-read skills after install
  const freshSkillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = freshSkillsService.getAllSkills();
  const installedPaths = installResult.installedPaths ?? (installResult.basePath ? [installResult.basePath] : []);
  if (installedPaths.length === 0) {
    return;
  }

  const installedSkills = allSkills.filter((skill) =>
    installedPaths.some((installedPath) => skill.path === installedPath || skill.path.startsWith(`${installedPath}/`))
  );

  if (installedSkills.length === 0) {
    if (options.json) {
      jsonError('No skills found after installation.', 'NO_SKILLS_FOUND');
    } else {
      console.log('No skills found after installation.');
    }
    rollback();
    process.exit(1);
  }

  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);
  const groupsData = loadGroupsData(new GroupsService());

  let selectedNames: string[];
  try {
    selectedNames = (options.skill && options.skill.length > 0)
      ? filterSkillsByFlag(installedSkills, options.skill)
      : options.all
        ? installedSkills.map((s) => s.name)
        : await promptSkillsFromRepo(installedSkills, options.global ? [] : deployedNames, groupsData);
  } catch {
    rollback();
    return;
  }

  const newSkills = options.global
    ? selectedNames
    : selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    rollback();
    return;
  }

  const deployMode = options.copy ? 'copy' : 'link';

  try {
    if (options.global) {
      const results = await deploySkillsGlobal(newSkills, freshSkillsService, deployer, selectedAgents, deployMode, options.json);
      if (options.json) {
        jsonOutput({
          deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
        });
      }
    } else {
      const results = await deploySkills(newSkills, freshSkillsService, deployer, scanner, deployMode, options.json);
      if (options.json) {
        jsonOutput({
          deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
        });
      } else {
        ensureSymlinkBridges(selectedAgents, deployer);
      }
    }
  } catch (error) {
    rollback();
    throw error;
  }
}

async function handleGroupBatchDeploy(
  groupName: string,
  options: AddOptions,
  scanner: DeploymentScanner,
  deployer: Deployer,
): Promise<void> {
  const groupsService = new GroupsService();
  const skillKeys = groupsService.getGroup(groupName);

  if (!skillKeys || skillKeys.length === 0) {
    if (options.json) {
      jsonError(`No skills found in group '${groupName}'.`, 'GROUP_NOT_FOUND');
    } else {
      console.log(`No skills found in group '${groupName}'.`);
    }
    process.exit(1);
    return;
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();

  const groupSkills: SkillInfo[] = [];
  for (const key of skillKeys) {
    const match = allSkills.find((s) => `${s.source}/${s.name}` === key);
    if (match) {
      groupSkills.push(match);
    } else {
      if (!options.json) console.log(`Skill '${key}' not found, skipping.`);
    }
  }

  if (groupSkills.length === 0) {
    if (options.json) {
      jsonError(`No valid skills found in group '${groupName}'.`, 'GROUP_EMPTY');
    } else {
      console.log(`No valid skills found in group '${groupName}'.`);
    }
    process.exit(1);
  }

  const selectedAgents = await resolveTargetAgents(
    options,
    () => scanner.getConfiguredTools(),
    options.global,
  );

  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);
  const groupsData = loadGroupsData(groupsService);
  const selectedNames = options.all
    ? groupSkills.map((s) => s.name)
    : await promptSkillsFromRepo(groupSkills, options.global ? [] : deployedNames, groupsData);
  const newSkills = options.global
    ? selectedNames
    : selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    if (!options.json) console.log('No new skills selected.');
    return;
  }

  const deployMode = options.copy ? 'copy' : 'link';

  if (options.global) {
    const results = await deploySkillsGlobal(newSkills, skillsService, deployer, selectedAgents, deployMode, options.json);
    if (options.json) {
      jsonOutput({
        deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
      });
    }
    return;
  }

  const results = await deploySkills(newSkills, skillsService, deployer, scanner, deployMode, options.json);
  if (options.json) {
    jsonOutput({
      deployed: results.map((r) => ({ name: r.name, agents: selectedAgents, mode: r.mode })),
    });
    return;
  }
  ensureSymlinkBridges(selectedAgents, deployer);
}

export async function executeAdd(
  arg: string | undefined,
  options: AddOptions
): Promise<void> {
  if (options.json || options.y) {
    if (!options.all) options.all = true;
    if (!options.agent?.length && !options.sameAgents) options.sameAgents = true;
  }

  if (options.group && arg) {
    console.log('Cannot use --group with a skill argument.');
    process.exit(1);
  }

  // --group batch deploy
  if (options.group) {
    await ensureSetup();
    const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
    const deployer = new Deployer(process.cwd());
    await handleGroupBatchDeploy(options.group, options, scanner, deployer);
    return;
  }

  // No argument → add-only flow (locked deployed skills, only new additions)
  if (!arg) {
    await ensureSetup();
    const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
    const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
    const deployer = new Deployer(process.cwd());
    const allSkills = skillsService.getAllSkills();
    await handleRepoSkillSelection(allSkills, options, skillsService, scanner, deployer);
    return;
  }

  await ensureSetup();

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());

  const format = detectArgFormat(arg);

  switch (format) {
    case 'skill-name':
      await handleSkillName(arg, options, skillsService, scanner, deployer);
      break;
    case 'owner-repo':
      await handleOwnerRepo(arg, options, skillsService, scanner, deployer);
      break;
    case 'install-source':
      await handleUrl(arg, options, scanner, deployer);
      break;
  }
}

export const addCommand = new Command('add')
  .description('Add a skill to the project (or globally with -g)')
  .argument('[arg]', 'Skill name, owner/repo, or URL')
  .option('--all', 'Add all skills without prompting')
  .option('-y', 'Skip all prompts (implies --all --same-agents)')
  .option('--copy', 'Copy files instead of creating symlinks')
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .option('-g, --global', 'Install globally to agent user-level directories')
  .option('--group <name>', 'Batch deploy all skills from a group')
  .option('-s, --skill <name>', 'Specific skill to add (repeatable)', collect, [])
  .option('--same-agents', 'Use currently configured agents')
  .option('--json', 'Output as JSON (implies --all)')
  .action(async (arg: string | undefined, options: AddOptions) => {
    await executeAdd(arg, options);
  });

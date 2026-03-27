import { Command } from 'commander';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { rollbackInstall } from '../services/rollback.js';
import { installSource } from './install.js';
import { AddOptions, SkillInfo, ToolName } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptSelect, resolveTargetAgents } from '../utils/prompts.js';
import { interactiveCheckbox, SelectChoice } from '../utils/interactive-select.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { executeSetup } from './setup.js';
import { executeInit } from './init.js';
import { detectSourceType } from '../utils/source-detection.js';

function detectArgFormat(arg: string): 'owner-repo' | 'skill-name' | 'install-source' {
  const sourceType = detectSourceType(arg);

  if (sourceType === 'owner-repo') {
    return 'owner-repo';
  }

  if (sourceType === 'unknown') {
    return 'skill-name';
  }

  return 'install-source';
}

function findRepoInCentralRepository(
  ownerRepo: string,
  skillsService: SkillsService,
): SkillInfo[] | null {
  const [inputOwner, inputRepo] = ownerRepo.split('/');

  const allSkills = skillsService.getAllSkills();

  // Match official: source = "official/{providerKey}/{repoName}"
  const providerKey = findOfficialProvider(inputOwner);
  if (providerKey) {
    const prefix = `official/${providerKey}/${inputRepo}`;
    const matched = allSkills.filter((s) => s.source === prefix);
    if (matched.length > 0) return matched;
  }

  // Match community: source = "community/{owner}/{repo}"
  const communityPrefix = `community/${inputOwner}/${inputRepo}`;
  const communityMatched = allSkills.filter((s) => s.source === communityPrefix);
  if (communityMatched.length > 0) return communityMatched;

  return null;
}

async function promptSkillsFromRepo(
  repoSkills: SkillInfo[],
  deployedSkillNames: string[],
): Promise<string[]> {
  const choices: SelectChoice[] = repoSkills.map((skill) => {
    const isDeployed = deployedSkillNames.includes(skill.name);
    return {
      name: skill.name,
      description: skill.description,
      value: skill.name,
      checked: isDeployed,
      locked: isDeployed,
      suffix: isDeployed ? '[deployed]' : undefined,
    };
  });

  return interactiveCheckbox({
    message: 'Select skills to add:',
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
): Promise<void> {
  const deployedSkills = scanner.getDeployedSkills();
  const deployedNames = new Set(deployedSkills.map((s) => s.name));

  for (const name of skillNames) {
    if (deployedNames.has(name)) continue;

    const skill = skillsService.getSkillByName(name);
    if (!skill) {
      console.log(`  ⚠ ${name} (not found in central repository)`);
      continue;
    }

    deployer.deploySkill(skill, deployMode);
    console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
  }
}

async function deploySkillsGlobal(
  skillNames: string[],
  skillsService: SkillsService,
  deployer: Deployer,
  agents: ToolName[],
  deployMode: 'link' | 'copy',
): Promise<void> {
  for (const name of skillNames) {
    const skill = skillsService.getSkillByName(name);
    if (!skill) {
      console.log(`  ⚠ ${name} (not found in central repository)`);
      continue;
    }

    deployer.deploySkillGlobal(skill, agents, deployMode);
  }
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
  const matchingSkills = skillsService.findSkillsByName(name);

  if (matchingSkills.length === 0) {
    await handleRemoteInstallAndDeploy(name, options, scanner, deployer);
    return;
  }

  let skill = matchingSkills[0];
  if (matchingSkills.length > 1) {
    console.log(`Multiple skills found with name '${name}':`);
    const choices = matchingSkills.map((s, i) => ({
      name: `${i + 1}. ${s.source}/${s.name}`,
      value: s.source,
    }));
    const selectedSource = await promptSelect('Select skill:', choices);
    skill = matchingSkills.find((s) => s.source === selectedSource)!;
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
    console.log(`  · ${skill.name} (already deployed)`);
    return;
  }

  const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  const deployMode = options.copy ? 'copy' : 'link';

  deployer.deploySkill(skill, deployMode);
  console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);

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
    console.log('All skills from this source are already deployed.');
    return;
  }

  const selectedNames = await promptSkillsFromRepo(repoSkills, options.global ? [] : deployedNames);
  const newSkills = options.global
    ? selectedNames
    : selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    console.log('No new skills selected.');
    return;
  }

  if (options.global) {
    const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools(), true);
    const deployMode = options.copy ? 'copy' : 'link';
    await deploySkillsGlobal(newSkills, skillsService, deployer, selectedAgents, deployMode);
    return;
  }

  const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  const deployMode = options.copy ? 'copy' : 'link';

  await deploySkills(newSkills, skillsService, deployer, scanner, deployMode);
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
    installResult = await installSource(source, { all: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }

  const rollback = () => rollbackInstall(
    installResult.basePath,
    installResult.sourceKey,
    installResult.installedPaths,
    installResult.sourceKeys,
  );

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
    console.log('No skills found after installation.');
    rollback();
    process.exit(1);
  }

  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);

  let selectedNames: string[];
  try {
    selectedNames = await promptSkillsFromRepo(installedSkills, options.global ? [] : deployedNames);
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

  if (options.global) {
    let selectedAgents: ToolName[];
    try {
      selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools(), true);
    } catch {
      rollback();
      return;
    }

    const deployMode = options.copy ? 'copy' : 'link';
    try {
      await deploySkillsGlobal(newSkills, freshSkillsService, deployer, selectedAgents, deployMode);
    } catch (error) {
      rollback();
      throw error;
    }
    return;
  }

  let selectedAgents: ToolName[];
  try {
    selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  } catch {
    rollback();
    return;
  }

  const deployMode = options.copy ? 'copy' : 'link';

  try {
    await deploySkills(newSkills, freshSkillsService, deployer, scanner, deployMode);
    ensureSymlinkBridges(selectedAgents, deployer);
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
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const allSkills = skillsService.getAllSkills();
  const groupSkills = allSkills.filter((s) => s.source.startsWith(`custom/${groupName}`));

  if (groupSkills.length === 0) {
    console.log(`No skills found in group '${groupName}'.`);
    process.exit(1);
    return;
  }

  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);
  const selectedNames = await promptSkillsFromRepo(groupSkills, options.global ? [] : deployedNames);
  const newSkills = options.global
    ? selectedNames
    : selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    console.log('No new skills selected.');
    return;
  }

  if (options.global) {
    const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools(), true);
    const deployMode = options.copy ? 'copy' : 'link';
    await deploySkillsGlobal(newSkills, skillsService, deployer, selectedAgents, deployMode);
    return;
  }

  const selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  const deployMode = options.copy ? 'copy' : 'link';

  await deploySkills(newSkills, skillsService, deployer, scanner, deployMode);
  ensureSymlinkBridges(selectedAgents, deployer);
}

export async function executeAdd(
  arg: string | undefined,
  options: AddOptions
): Promise<void> {
  if (options.group && arg) {
    console.log('Cannot use --group with a skill argument.');
    process.exit(1);
    return;
  }

  // --group batch deploy
  if (options.group) {
    if (!fileExists(SKILLS_MANAGER_DIR)) {
      await executeSetup();
      console.log();
    }
    const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
    const deployer = new Deployer(process.cwd());
    await handleGroupBatchDeploy(options.group, options, scanner, deployer);
    return;
  }

  // No argument → init flow
  if (!arg) {
    await executeInit({ copy: options.copy, global: options.global });
    return;
  }

  if (!fileExists(SKILLS_MANAGER_DIR)) {
    await executeSetup();
    console.log();
  }

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
  .option('--copy', 'Copy files instead of creating symlinks')
  .option('-a, --agent <agents>', 'Target agents (comma-separated)')
  .option('-g, --global', 'Install globally to agent user-level directories')
  .option('--group <name>', 'Batch deploy all skills from a group')
  .option('-s, --same-agents', 'Use currently configured agents')
  .action(async (arg: string | undefined, options: AddOptions) => {
    await executeAdd(arg, options);
  });

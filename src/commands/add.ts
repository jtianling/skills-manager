import { Command } from 'commander';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { rollbackInstall } from '../services/rollback.js';
import { installSource } from './install.js';
import { AddOptions, SkillInfo, collect } from '../types.js';
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

function ensureSymlinkBridges(
  selectedAgents: string[],
  deployer: Deployer,
): void {
  const agentsSelected = selectedAgents.includes('agents-skills-standard');
  const nonNativeAgents = selectedAgents.filter((t) => t !== 'agents-skills-standard');

  if (!agentsSelected && nonNativeAgents.length === 0) return;

  for (const agentName of nonNativeAgents) {
    const config = TOOL_CONFIGS[agentName as keyof typeof TOOL_CONFIGS];
    if (!config || config.native) continue;

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

  if (allDeployed) {
    console.log('All skills from this source are already deployed.');
    return;
  }

  const selectedNames = (options.skill && options.skill.length > 0)
    ? filterSkillsByFlag(repoSkills, options.skill)
    : await promptSkillsFromRepo(repoSkills, deployedNames);
  const newSkills = selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    console.log('No new skills selected.');
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
    installResult = await installSource(source, { all: true, group: options.group });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
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
    console.log('No skills found after installation.');
    rollbackInstall(
      installResult.basePath,
      installResult.sourceKey,
      installResult.installedPaths,
      installResult.sourceKeys,
    );
    process.exit(1);
  }

  const deployedNames = scanner.getDeployedSkills().map((s) => s.name);

  let selectedNames: string[];
  try {
    selectedNames = (options.skill && options.skill.length > 0)
      ? filterSkillsByFlag(installedSkills, options.skill)
      : await promptSkillsFromRepo(installedSkills, deployedNames);
  } catch {
    rollbackInstall(
      installResult.basePath,
      installResult.sourceKey,
      installResult.installedPaths,
      installResult.sourceKeys,
    );
    return;
  }

  const newSkills = selectedNames.filter((n) => !deployedNames.includes(n));

  if (newSkills.length === 0) {
    rollbackInstall(
      installResult.basePath,
      installResult.sourceKey,
      installResult.installedPaths,
      installResult.sourceKeys,
    );
    return;
  }

  let selectedAgents: string[];
  try {
    selectedAgents = await resolveTargetAgents(options, () => scanner.getConfiguredTools());
  } catch {
    rollbackInstall(
      installResult.basePath,
      installResult.sourceKey,
      installResult.installedPaths,
      installResult.sourceKeys,
    );
    return;
  }

  const deployMode = options.copy ? 'copy' : 'link';

  try {
    await deploySkills(newSkills, freshSkillsService, deployer, scanner, deployMode);
    ensureSymlinkBridges(selectedAgents, deployer);
  } catch (error) {
    rollbackInstall(
      installResult.basePath,
      installResult.sourceKey,
      installResult.installedPaths,
      installResult.sourceKeys,
    );
    throw error;
  }
}

export async function executeAdd(
  arg: string | undefined,
  options: AddOptions
): Promise<void> {
  // No argument → init flow
  if (!arg) {
    await executeInit({ copy: options.copy });
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
  .description('Add a skill to the project')
  .argument('[arg]', 'Skill name, owner/repo, or URL')
  .option('--copy', 'Copy files instead of creating symlinks')
  .option('-a, --agent <name>', 'Target agent (repeatable)', collect, [])
  .option('-g, --group <name>', 'Group name to use when installing missing skills')
  .option('-s, --skill <name>', 'Specific skill to add (repeatable)', collect, [])
  .option('--same-agents', 'Use currently configured agents')
  .action(async (arg: string | undefined, options: AddOptions) => {
    await executeAdd(arg, options);
  });

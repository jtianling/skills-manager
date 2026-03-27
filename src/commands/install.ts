import { dirname, join } from 'path';
import { Command } from 'commander';
import { OFFICIAL_PROVIDERS, SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import type { OfficialProviderRepo } from '../constants.js';
import { GitHubService } from '../services/github.js';
import type { InstallOptions } from '../types.js';
import { fileExists, findScriptFiles, warnScriptFiles } from '../utils/fs.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { ProgressBar } from '../utils/progress.js';
import { detectSourceType } from '../utils/source-detection.js';
import { installViaGitClone } from './install-git.js';
import { installFromLocalDir, installFromRemoteZip, installFromZip } from './install-local.js';
import {
  createInstallResult,
  getCustomSkillDir,
  getLocalOverwriteMessage,
  getRemoteSkillTargetDir,
  parseMdFrontmatter,
  parseMdDescription,
  prepareTargetDir,
  saveGroupedGitSource,
  saveRepoGitSource,
  selectSkills,
  validateGroupName,
} from './install-utils.js';
import type { InstallResult, InstallableSkill } from './install-utils.js';

async function fetchSkillsFromRepo(
  githubService: GitHubService,
  owner: string,
  repoConfig: OfficialProviderRepo,
): Promise<Array<InstallableSkill & { repoName: string }>> {
  const { repo, skillsPath } = repoConfig;
  const skills: Array<InstallableSkill & { repoName: string }> = [];

  let skillsList: Array<{ name: string; path: string }> = [];

  if (skillsPath) {
    skillsList = await githubService.listSkills(owner, repo, skillsPath);
  } else {
    const skillsPaths = ['skills', '.', 'src/skills'];
    for (const path of skillsPaths) {
      try {
        skillsList = await githubService.listSkills(owner, repo, path);
        if (skillsList.length > 0) {
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (skillsList.length === 0) {
    return skills;
  }

  const defaultBranch = await githubService.getDefaultBranch(owner, repo);

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`,
      );

      if (response.ok) {
        const content = await response.text();
        skills.push({ name: skill.name, description: parseMdDescription(content), path: skill.path, repoName: repo });
        continue;
      }

      const subDirs = await githubService.listSkills(owner, repo, skill.path);
      for (const sub of subDirs) {
        try {
          const subResponse = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${sub.path}/SKILL.md`,
          );
          if (subResponse.ok) {
            const content = await subResponse.text();
            skills.push({ name: sub.name, description: parseMdDescription(content), path: sub.path, repoName: repo });
          }
        } catch {
          continue;
        }
      }
    } catch {
      skills.push({ name: skill.name, description: '', path: skill.path, repoName: repo });
    }
  }

  return skills;
}

export async function installFromOfficial(
  providerKey: string,
  options: InstallOptions,
  targetRepo?: string,
): Promise<InstallResult> {
  validateGroupName(options.group);

  const provider = OFFICIAL_PROVIDERS[providerKey];
  const githubService = new GitHubService();
  const { owner } = provider;

  const reposToFetch = targetRepo
    ? provider.repos.filter((repoConfig) => repoConfig.repo === targetRepo)
    : provider.repos;

  const allSkills: Array<InstallableSkill & { repoName: string }> = [];

  for (const repoConfig of reposToFetch) {
    console.log(`Fetching available skills from ${owner}/${repoConfig.repo}...`);
    try {
      const repoSkills = await fetchSkillsFromRepo(githubService, owner, repoConfig);
      allSkills.push(...repoSkills);
    } catch {
      console.log(`  Warning: Failed to fetch from ${owner}/${repoConfig.repo}, skipping`);
      if (reposToFetch.length === 1) {
        throw new Error('No skills found in repository');
      }
    }
  }

  if (allSkills.length === 0) {
    throw new Error('No skills found in repository');
  }

  console.log(`Found ${allSkills.length} skills.\n`);

  let selectedSkills = allSkills;
  if (!options.all) {
    const choices = allSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      value: skill.name,
      subGroup: skill.repoName,
    }));

    const selectedNames = await interactiveCheckbox({
      message: 'Select skills to install:',
      choices,
      pageSize: 15,
    });

    if (selectedNames.length === 0) {
      console.log('No skills selected');
      return createInstallResult([], []);
    }

    selectedSkills = allSkills.filter((skill) => selectedNames.includes(skill.name));
  }

  console.log(`\nDownloading ${selectedSkills.length} skills...`);

  const installedRepos = new Set<string>();
  const installedPaths: string[] = [];
  const sourceKeys: string[] = [];
  const allScriptFiles: string[] = [];

  for (const skill of selectedSkills) {
    const targetDir = options.group
      ? getCustomSkillDir(skill.name, options.group)
      : join(SKILLS_MANAGER_DIR, 'official', providerKey, skill.repoName, skill.name);

    const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skill.name, options.group), options.force);
    if (!ready) {
      break;
    }

    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, skill.repoName, skill.path, targetDir);
    console.log(' ✓');

    installedPaths.push(targetDir);
    allScriptFiles.push(...findScriptFiles(targetDir));
    installedRepos.add(skill.repoName);

    if (options.group) {
      sourceKeys.push(saveGroupedGitSource(skill.name, owner, skill.repoName, options));
    }
  }

  warnScriptFiles(allScriptFiles);

  if (!options.group) {
    for (const repoName of installedRepos) {
      sourceKeys.push(saveRepoGitSource(owner, repoName, options));
    }
  }

  const targetBase = options.group
    ? join(SKILLS_MANAGER_DIR, 'custom', options.group)
    : join(SKILLS_MANAGER_DIR, 'official', providerKey);

  console.log(`\n✓ Installed ${installedPaths.length} skills to ${targetBase}`);
  return createInstallResult(installedPaths, sourceKeys);
}

function getRemoteRepoTargetBase(
  owner: string,
  repo: string,
  options: InstallOptions,
  officialMatch: ReturnType<typeof findOfficialProvider>,
): string {
  if (options.group) {
    return join(SKILLS_MANAGER_DIR, 'custom', options.group);
  }

  if (officialMatch) {
    return join(SKILLS_MANAGER_DIR, 'official', officialMatch.providerKey, repo);
  }

  if (options.custom) {
    return join(SKILLS_MANAGER_DIR, 'custom', repo);
  }

  return join(SKILLS_MANAGER_DIR, 'community', owner, repo);
}

async function installDirectGitHubSkill(
  githubService: GitHubService,
  owner: string,
  repo: string,
  path: string,
  options: InstallOptions,
): Promise<InstallResult> {
  const skillName = path.split('/').pop() || path;
  const targetDir = getRemoteSkillTargetDir(owner, repo, skillName, options);
  const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skillName, options.group), options.force);
  if (!ready) {
    return createInstallResult([], []);
  }

  console.log(`Downloading ${skillName}...`);
  await githubService.downloadSkill(owner, repo, path, targetDir);
  warnScriptFiles(findScriptFiles(targetDir));
  console.log(`✓ Installed ${skillName} to ${targetDir}`);

  const sourceKey = options.group
    ? saveGroupedGitSource(skillName, owner, repo, options)
    : saveRepoGitSource(owner, repo, options, `https://github.com/${owner}/${repo}`);

  return createInstallResult([targetDir], [sourceKey]);
}

async function listGitHubRepoSkills(
  githubService: GitHubService,
  owner: string,
  repo: string,
): Promise<Array<{ name: string; path: string }>> {
  const skillsPaths = ['skills', '.', 'src/skills'];

  for (const skillsPath of skillsPaths) {
    try {
      const skills = await githubService.listSkills(owner, repo, skillsPath);
      if (skills.length > 0) {
        return skills;
      }
    } catch {
      continue;
    }
  }

  return [];
}

async function installRootSkillFromGitHubRepo(
  githubService: GitHubService,
  owner: string,
  repo: string,
  defaultBranch: string,
  options: InstallOptions,
): Promise<InstallResult | null> {
  const rootSkillContent = await githubService.fetchRootFile(owner, repo, defaultBranch, 'SKILL.md');
  if (!rootSkillContent) {
    return null;
  }

  const frontmatter = parseMdFrontmatter(rootSkillContent);
  const skillName = frontmatter.name || repo;
  const description = frontmatter.description ?? '';
  console.log(`Found root skill: ${skillName}${description ? ` - ${description}` : ''}`);

  const targetDir = getRemoteSkillTargetDir(owner, repo, skillName, options);
  const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skillName, options.group), options.force);
  if (!ready) {
    return createInstallResult([], []);
  }

  process.stdout.write(`  Downloading ${skillName}...`);
  await githubService.downloadRepoRoot(owner, repo, targetDir);
  console.log(' ✓');
  warnScriptFiles(findScriptFiles(targetDir));

  const sourceKey = options.group
    ? saveGroupedGitSource(skillName, owner, repo, options)
    : saveRepoGitSource(owner, repo, options);

  const targetBase = options.group ? join(SKILLS_MANAGER_DIR, 'custom', options.group) : dirname(targetDir);
  console.log(`\n✓ Installed 1 skill to ${targetBase}`);
  return createInstallResult([targetDir], [sourceKey]);
}

async function fetchGitHubSkillInfo(
  githubService: GitHubService,
  owner: string,
  repo: string,
  defaultBranch: string,
  skillsList: Array<{ name: string; path: string }>,
): Promise<InstallableSkill[]> {
  const skills: InstallableSkill[] = [];
  const progress = new ProgressBar(skillsList.length, 'Fetching skill info');
  progress.start();

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`,
      );

      if (response.ok) {
        const content = await response.text();
        skills.push({ name: skill.name, description: parseMdDescription(content), path: skill.path });
        continue;
      }

      const subDirs = await githubService.listSkills(owner, repo, skill.path);
      for (const sub of subDirs) {
        try {
          const subResponse = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${sub.path}/SKILL.md`,
          );
          if (subResponse.ok) {
            const content = await subResponse.text();
            skills.push({ name: sub.name, description: parseMdDescription(content), path: sub.path });
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    } finally {
      progress.tick();
    }
  }

  progress.complete();
  return skills;
}

async function installSelectedGitHubSkills(
  githubService: GitHubService,
  owner: string,
  repo: string,
  skills: InstallableSkill[],
  options: InstallOptions,
  officialMatch: ReturnType<typeof findOfficialProvider>,
): Promise<InstallResult> {
  console.log(`Found ${skills.length} skills.\n`);

  const selectedSkills = await selectSkills(skills, options);
  if (selectedSkills.length === 0) {
    return createInstallResult([], []);
  }

  console.log(`\nDownloading ${selectedSkills.length} skills...`);

  const installedPaths: string[] = [];
  const sourceKeys: string[] = [];
  const allScriptFiles: string[] = [];

  for (const skill of selectedSkills) {
    const targetDir = getRemoteSkillTargetDir(owner, repo, skill.name, options);
    const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skill.name, options.group), options.force);
    if (!ready) {
      break;
    }

    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');

    installedPaths.push(targetDir);
    allScriptFiles.push(...findScriptFiles(targetDir));

    if (options.group) {
      sourceKeys.push(saveGroupedGitSource(skill.name, owner, repo, options));
    }
  }

  warnScriptFiles(allScriptFiles);

  if (!options.group && installedPaths.length > 0) {
    sourceKeys.push(saveRepoGitSource(owner, repo, options));
  }

  const targetBase = getRemoteRepoTargetBase(owner, repo, options, officialMatch);
  console.log(`\n✓ Installed ${installedPaths.length} skills to ${targetBase}`);
  return createInstallResult(installedPaths, sourceKeys);
}

export async function installFromGitHubUrl(
  url: string,
  options: InstallOptions,
): Promise<InstallResult | null> {
  validateGroupName(options.group);

  const githubService = new GitHubService();
  const parsed = githubService.parseGitHubUrl(url);
  if (!parsed) {
    return null;
  }

  const { owner, repo, path } = parsed;
  const officialMatch = findOfficialProvider(owner, repo);

  if (path) {
    return installDirectGitHubSkill(githubService, owner, repo, path, options);
  }

  console.log(`Fetching available content from ${owner}/${repo}...`);
  const skillsList = await listGitHubRepoSkills(githubService, owner, repo);
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);

  if (skillsList.length === 0) {
    return installRootSkillFromGitHubRepo(githubService, owner, repo, defaultBranch, options);
  }

  const skills = await fetchGitHubSkillInfo(githubService, owner, repo, defaultBranch, skillsList);
  if (skills.length === 0) {
    return null;
  }

  return installSelectedGitHubSkills(githubService, owner, repo, skills, options, officialMatch);
}

async function installResolvedRemoteSource(source: string, options: InstallOptions): Promise<InstallResult> {
  if (source.includes('github.com')) {
    const result = await installFromGitHubUrl(source, options);
    if (result) {
      return result;
    }

    console.log('GitHub API failed, falling back to git clone...');
  }

  return installViaGitClone(source, options);
}

async function installBySourceType(source: string, options: InstallOptions): Promise<InstallResult> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'remote-zip':
      return installFromRemoteZip(source, options);
    case 'local-zip':
      return installFromZip(source, options);
    case 'owner-repo': {
      const normalizedSource = source.replace(/\/$/, '');
      const [owner, repo] = normalizedSource.split('/');
      const officialMatch = findOfficialProvider(owner, repo);
      if (officialMatch?.exactRepoMatch) {
        return installFromOfficial(officialMatch.providerKey, options, repo);
      }

      const resolvedSource = `https://github.com/${normalizedSource}`;
      console.log(`Resolved to ${resolvedSource}`);
      return installResolvedRemoteSource(resolvedSource, options);
    }
    case 'remote-url':
      return installResolvedRemoteSource(source, options);
    case 'local-path':
      return installFromLocalDir(source, options);
    default: {
      const _exhaustive: never = sourceType;
      return _exhaustive;
    }
  }
}

export async function installSource(source: string, options: InstallOptions = {}): Promise<InstallResult> {
  return installBySourceType(source, { all: true, ...options });
}

export async function executeInstall(source: string, options: InstallOptions): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  try {
    await installBySourceType(source, options);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export { InstallResult };

export const installCommand = new Command('install')
  .alias('i')
  .description('Install skills from a local path, zip archive, repository, or URL')
  .argument('<source>', 'Local path, zip file, owner/repo, or URL')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .option('-g, --group <name>', 'Group name for organizing installed skills under custom/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

import { dirname, join } from 'path';
import { Command } from 'commander';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { GitHubService } from '../services/github.js';
import type { InstallOptions } from '../types.js';
import { fileExists, findScriptFiles, warnScriptFiles } from '../utils/fs.js';
import { ProgressBar } from '../utils/progress.js';
import { detectSourceType } from '../utils/source-detection.js';
import { installViaGitClone } from './install-git.js';
import { installFromLocalDir, installFromRemoteZip, installFromZip } from './install-local.js';
import {
  createInstallResult,
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

function getRemoteRepoTargetBase(
  owner: string,
  repo: string,
  options: InstallOptions,
  providerKey: string | null,
): string {
  if (options.group) {
    return join(SKILLS_MANAGER_DIR, 'custom', options.group);
  }

  if (providerKey) {
    return join(SKILLS_MANAGER_DIR, 'official', providerKey, repo);
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

async function fetchManifestSkillPaths(
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<string[]> {
  const paths: string[] = [];

  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/.claude-plugin/marketplace.json`;
    const response = await fetch(url);
    if (response.ok) {
      const manifest = await response.json() as { metadata?: { pluginRoot?: string }; plugins?: Array<{ source?: string | { source: string }; skills?: string | string[] }> };
      const pluginRoot = manifest.metadata?.pluginRoot?.replace(/^\.\//, '') ?? '';

      for (const plugin of manifest.plugins ?? []) {
        if (typeof plugin.source !== 'string') continue;
        const source = plugin.source.replace(/^\.\//, '');
        const pluginBase = pluginRoot ? `${pluginRoot}/${source}` : source;

        if (typeof plugin.skills === 'string') {
          paths.push(`${pluginBase}/${plugin.skills}`.replace(/\/+/g, '/').replace(/\/$/, ''));
        } else {
          paths.push(`${pluginBase}/skills`);
        }
      }
    }
  } catch {
    // Manifest not available
  }

  try {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/.claude-plugin/plugin.json`;
    const response = await fetch(url);
    if (response.ok) {
      const manifest = await response.json() as { skills?: string | string[] };
      if (typeof manifest.skills === 'string') {
        paths.push(manifest.skills.replace(/^\.\//, '').replace(/\/$/, ''));
      }
    }
  } catch {
    // Manifest not available
  }

  return [...new Set(paths)];
}

async function listGitHubRepoSkills(
  githubService: GitHubService,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<Array<{ name: string; path: string }>> {
  const seenNames = new Set<string>();
  const allSkills: Array<{ name: string; path: string }> = [];

  // 1. Discover from manifest
  const manifestPaths = await fetchManifestSkillPaths(owner, repo, defaultBranch);
  for (const manifestPath of manifestPaths) {
    try {
      const skills = await githubService.listSkills(owner, repo, manifestPath);
      for (const skill of skills) {
        if (!seenNames.has(skill.name)) {
          seenNames.add(skill.name);
          allSkills.push(skill);
        }
      }
    } catch {
      continue;
    }
  }

  // 2. Discover from priority standard paths
  for (const skillsPath of ['skills', '.github/skills']) {
    try {
      const skills = await githubService.listSkills(owner, repo, skillsPath);
      for (const skill of skills) {
        if (!seenNames.has(skill.name)) {
          seenNames.add(skill.name);
          allSkills.push(skill);
        }
      }
    } catch {
      continue;
    }
  }

  // 3. Fallback: scan root and src/skills only if nothing found yet
  if (allSkills.length === 0) {
    for (const fallbackPath of ['.', 'src/skills']) {
      try {
        const skills = await githubService.listSkills(owner, repo, fallbackPath);
        if (skills.length > 0) {
          return skills;
        }
      } catch {
        continue;
      }
    }
  }

  return allSkills;
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
  providerKey: string | null,
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

  const targetBase = getRemoteRepoTargetBase(owner, repo, options, providerKey);
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
  const providerKey = findOfficialProvider(owner);

  if (path) {
    return installDirectGitHubSkill(githubService, owner, repo, path, options);
  }

  console.log(`Fetching available content from ${owner}/${repo}...`);
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);
  const skillsList = await listGitHubRepoSkills(githubService, owner, repo, defaultBranch);

  if (skillsList.length === 0) {
    return installRootSkillFromGitHubRepo(githubService, owner, repo, defaultBranch, options);
  }

  const skills = await fetchGitHubSkillInfo(githubService, owner, repo, defaultBranch, skillsList);
  if (skills.length === 0) {
    return null;
  }

  return installSelectedGitHubSkills(githubService, owner, repo, skills, options, providerKey);
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
      return installViaGitClone(`https://github.com/${normalizedSource}`, options);
    }
    case 'remote-url':
      return installResolvedRemoteSource(source, options);
    case 'local-path':
      return installFromLocalDir(source, options);
    case 'unknown':
      throw new Error(
        `Unknown source format '${source}'. Use ./name for local, owner/repo for GitHub.`
      );
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

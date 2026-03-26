import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR, OFFICIAL_PROVIDERS, findOfficialProvider } from '../constants.js';
import { GitService } from '../services/git.js';
import { GitHubService } from '../services/github.js';
import { SourcesService } from '../services/sources.js';
import { InstallOptions } from '../types.js';
import { mkdirSync, readdirSync, renameSync } from 'fs';
import { fileExists, findScriptFiles, getDirectoriesInDir, readFileContent, removeDir, warnScriptFiles } from '../utils/fs.js';
import { promptSkillsToInstall } from '../utils/prompts.js';
import { ProgressBar } from '../utils/progress.js';

const sourcesService = new SourcesService();

/**
 * Parse SKILL.md frontmatter to extract description
 */
function parseMdFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}

function parseMdDescription(content: string): string {
  return parseMdFrontmatter(content).description ?? '';
}

/**
 * Install skills from an official provider using GitHub API
 */
async function installFromOfficial(providerKey: string, options: InstallOptions): Promise<void> {
  const provider = OFFICIAL_PROVIDERS[providerKey];
  const githubService = new GitHubService();
  const { owner, repo } = provider;

  console.log(`Fetching available skills from ${owner}/${repo}...`);

  let skillsList: Array<{ name: string; path: string }> = [];

  if (provider.skillsPath) {
    skillsList = await githubService.listSkills(owner, repo, provider.skillsPath);
  } else {
    const skillsPaths = ['skills', '.', 'src/skills'];
    for (const skillsPath of skillsPaths) {
      try {
        skillsList = await githubService.listSkills(owner, repo, skillsPath);
        if (skillsList.length > 0) break;
      } catch {
        continue;
      }
    }
  }

  const defaultBranch = await githubService.getDefaultBranch(owner, repo);
  const targetBase = join(SKILLS_MANAGER_DIR, 'official', providerKey);

  if (skillsList.length === 0) {
    console.error('Error: No skills found in repository');
    process.exit(1);
  }

  const skills: Array<{ name: string; description: string; path: string }> = [];
  const progress = new ProgressBar(skillsList.length, 'Fetching skill info');
  progress.start();

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        const content = await response.text();
        const description = parseMdDescription(content);
        skills.push({ name: skill.name, description, path: skill.path });
      } else {
        const subDirs = await githubService.listSkills(owner, repo, skill.path);
        for (const sub of subDirs) {
          try {
            const subResponse = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${sub.path}/SKILL.md`
            );
            if (subResponse.ok) {
              const content = await subResponse.text();
              const description = parseMdDescription(content);
              skills.push({ name: sub.name, description, path: sub.path });
            }
          } catch {
            // Skip nested dirs without SKILL.md
          }
        }
      }
    } catch {
      skills.push({ name: skill.name, description: '', path: skill.path });
    }
    progress.tick();
  }

  progress.complete();

  if (skills.length === 0) {
    console.error('Error: No skills found in repository');
    process.exit(1);
  }

  console.log(`Found ${skills.length} skills.\n`);

  let selectedSkills = skills;

  if (!options.all) {
    const selectedNames = await promptSkillsToInstall(skills);
    if (selectedNames.length === 0) {
      console.log('No skills selected');
      return;
    }
    selectedSkills = skills.filter((s) => selectedNames.includes(s.name));
  }

  console.log(`\nDownloading ${selectedSkills.length} skills...`);

  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
  }

  const allScriptFiles: string[] = [];
  for (const skill of selectedSkills) {
    allScriptFiles.push(...findScriptFiles(join(targetBase, skill.name)));
  }
  warnScriptFiles(allScriptFiles);

  console.log(`\n✓ Installed ${selectedSkills.length} skills to ${targetBase}`);

  sourcesService.addSource(`official/${providerKey}`, {
    url: `https://github.com/${owner}/${repo}`,
    type: 'official',
    repoName: providerKey,
  });
}

/**
 * Install skills from a GitHub URL using API
 */
async function installFromGitHubUrl(
  url: string,
  options: InstallOptions
): Promise<boolean> {
  const githubService = new GitHubService();
  const parsed = githubService.parseGitHubUrl(url);

  if (!parsed) {
    return false;
  }

  const { owner, repo, path } = parsed;
  const officialKey = findOfficialProvider(owner, repo);

  // If it's a specific skill path (e.g., /tree/main/skills/code-review)
  if (path) {
    const skillName = path.split('/').pop() || path;
    const targetDir = githubService.getTargetDir(owner, repo, skillName, options.custom);

    console.log(`Downloading ${skillName}...`);
    await githubService.downloadSkill(owner, repo, path, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));
    console.log(`✓ Installed ${skillName} to ${targetDir}`);
    return true;
  }

  // Otherwise, list and download skills from repo
  console.log(`Fetching available content from ${owner}/${repo}...`);

  // Try common skills directory locations
  let skillsList: Array<{ name: string; path: string }> = [];
  const skillsPaths = ['skills', '.', 'src/skills'];

  for (const skillsPath of skillsPaths) {
    try {
      skillsList = await githubService.listSkills(owner, repo, skillsPath);
      if (skillsList.length > 0) break;
    } catch {
      continue;
    }
  }

  // Get the default branch for raw content URLs
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);

  let targetBase: string;
  if (officialKey) {
    targetBase = join(SKILLS_MANAGER_DIR, 'official', officialKey);
  } else if (options.custom) {
    targetBase = join(SKILLS_MANAGER_DIR, 'custom', repo);
  } else {
    targetBase = join(SKILLS_MANAGER_DIR, 'community', owner, repo);
  }

  // If no skills found, check root SKILL.md
  if (skillsList.length === 0) {
    const rootSkillContent = await githubService.fetchRootFile(owner, repo, defaultBranch, 'SKILL.md');

    if (rootSkillContent) {
      const frontmatter = parseMdFrontmatter(rootSkillContent);
      const skillName = frontmatter.name || repo;
      const description = frontmatter.description ?? '';

      console.log(`Found root skill: ${skillName}${description ? ` - ${description}` : ''}`);

      const skillTargetDir = join(targetBase, skillName);
      process.stdout.write(`  Downloading ${skillName}...`);
      await githubService.downloadRepoRoot(owner, repo, skillTargetDir);
      console.log(' ✓');
      warnScriptFiles(findScriptFiles(skillTargetDir));

      console.log(`\n✓ Installed 1 skill to ${targetBase}`);

      const sourceKey = officialKey
        ? `official/${officialKey}`
        : options.custom
          ? `custom/${repo}`
          : `community/${owner}/${repo}`;
      sourcesService.addSource(sourceKey, {
        url: `https://github.com/${owner}/${repo}`,
        type: officialKey ? 'official' : options.custom ? 'custom' : 'community',
        repoName: officialKey || repo,
      });
      return true;
    }

    return false; // Fall back to git clone
  }

  // Filter to only directories that have SKILL.md, expanding group dirs one level
  const skills: Array<{ name: string; description: string; path: string }> = [];
  const progress = new ProgressBar(skillsList.length, 'Fetching skill info');
  progress.start();

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        const content = await response.text();
        const description = parseMdDescription(content);
        skills.push({ name: skill.name, description, path: skill.path });
      } else {
        // No SKILL.md — treat as group directory, expand one level
        const subDirs = await githubService.listSkills(owner, repo, skill.path);
        for (const sub of subDirs) {
          try {
            const subResponse = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${sub.path}/SKILL.md`
            );
            if (subResponse.ok) {
              const content = await subResponse.text();
              const description = parseMdDescription(content);
              skills.push({ name: sub.name, description, path: sub.path });
            }
          } catch {
            // Skip nested dirs without SKILL.md
          }
        }
      }
    } catch {
      // Skip on network errors
    }
    progress.tick();
  }

  progress.complete();

  if (skills.length === 0) {
    // No valid subdirectory skills, check root SKILL.md
    const rootSkillContent = await githubService.fetchRootFile(owner, repo, defaultBranch, 'SKILL.md');

    if (rootSkillContent) {
      const frontmatter = parseMdFrontmatter(rootSkillContent);
      const skillName = frontmatter.name || repo;
      const description = frontmatter.description ?? '';

      console.log(`Found root skill: ${skillName}${description ? ` - ${description}` : ''}`);

      const skillTargetDir = join(targetBase, skillName);
      process.stdout.write(`  Downloading ${skillName}...`);
      await githubService.downloadRepoRoot(owner, repo, skillTargetDir);
      console.log(' ✓');
      warnScriptFiles(findScriptFiles(skillTargetDir));

      console.log(`\n✓ Installed 1 skill to ${targetBase}`);

      const sourceKey = officialKey
        ? `official/${officialKey}`
        : options.custom
          ? `custom/${repo}`
          : `community/${owner}/${repo}`;
      sourcesService.addSource(sourceKey, {
        url: `https://github.com/${owner}/${repo}`,
        type: officialKey ? 'official' : options.custom ? 'custom' : 'community',
        repoName: officialKey || repo,
      });
      return true;
    }

    return false;
  }

  console.log(`Found ${skills.length} skills.\n`);

  let selectedSkills = skills;
  if (!options.all) {
    const selectedNames = await promptSkillsToInstall(skills);
    if (selectedNames.length === 0) {
      console.log('No skills selected');
      return true;
    }
    selectedSkills = skills.filter((s) => selectedNames.includes(s.name));
  }

  // Download selected skills
  console.log(`\nDownloading ${selectedSkills.length} skills...`);

  const allScriptFiles2: string[] = [];
  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
    allScriptFiles2.push(...findScriptFiles(targetDir));
  }
  warnScriptFiles(allScriptFiles2);

  console.log(`\n✓ Installed ${selectedSkills.length} skills to ${targetBase}`);

  // Save source info
  const sourceKey = officialKey
    ? `official/${officialKey}`
    : options.custom
      ? `custom/${repo}`
      : `community/${owner}/${repo}`;
  sourcesService.addSource(sourceKey, {
    url: `https://github.com/${owner}/${repo}`,
    type: officialKey ? 'official' : options.custom ? 'custom' : 'community',
    repoName: officialKey || repo,
  });

  return true;
}

/**
 * Fall back to git clone for non-GitHub or failed API attempts
 */
async function installViaGitClone(
  source: string,
  options: InstallOptions
): Promise<void> {
  const gitService = new GitService();

  // Extract owner/repo from GitHub URL for source tracking
  const ghMatch = source.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  const resolvedOwner = ghMatch?.[1];
  const resolvedRepo = ghMatch?.[2];

  // Check if this is a specific skill URL
  if (gitService.isSpecificSkillUrl(source)) {
    const skillPath = gitService.cloneSpecificSkill(source, options.custom || false);
    if (skillPath) {
      console.log(`✓ Installed skill to ${skillPath}`);
    } else {
      console.log('Failed to parse skill URL');
      process.exit(1);
    }
    return;
  }

  // Clone the repository
  const repoPath = gitService.clone(source, options.custom || false);

  // Find all skills in the repo — check skills/ subdir for all repos
  let skillsRoot = repoPath;
  const skillsSubdir = join(repoPath, 'skills');
  if (fileExists(skillsSubdir)) {
    skillsRoot = skillsSubdir;
  }

  const skills: Array<{ name: string; description: string; path: string }> = [];

  function scanForSkills(dir: string, maxDepth: number): void {
    for (const subdir of getDirectoriesInDir(dir)) {
      const skillMdPath = join(subdir.path, 'SKILL.md');
      if (fileExists(skillMdPath)) {
        const content = readFileContent(skillMdPath);
        const description = parseMdDescription(content);
        skills.push({ name: subdir.name, description, path: subdir.path });
      } else if (maxDepth > 1) {
        scanForSkills(subdir.path, maxDepth - 1);
      }
    }
  }

  scanForSkills(skillsRoot, 2);

  // Flatten nested skills to {repoPath}/{skill-name}/
  const groupDirsToClean = new Set<string>();
  for (const skill of skills) {
    const parentDir = join(skill.path, '..');
    const isNested = parentDir !== repoPath && parentDir !== skillsRoot;
    if (isNested) {
      const flatPath = join(repoPath, skill.name);
      if (!fileExists(flatPath)) {
        renameSync(skill.path, flatPath);
        skill.path = flatPath;
        groupDirsToClean.add(parentDir);
      }
    }
  }
  // Clean up empty group directories
  for (const groupDir of groupDirsToClean) {
    const remaining = readdirSync(groupDir);
    if (remaining.length === 0) {
      removeDir(groupDir);
    }
  }
  // Clean up skillsRoot if it's now empty and different from repoPath
  if (skillsRoot !== repoPath && fileExists(skillsRoot)) {
    const remaining = readdirSync(skillsRoot);
    if (remaining.length === 0) {
      removeDir(skillsRoot);
    }
  }

  // If no subdirectory skills found, check root SKILL.md
  if (skills.length === 0) {
    const rootSkillMd = join(repoPath, 'SKILL.md');
    if (fileExists(rootSkillMd)) {
      const content = readFileContent(rootSkillMd);
      const frontmatter = parseMdFrontmatter(content);
      const repoName = repoPath.split('/').pop() || source;
      const skillName = frontmatter.name || repoName;

      console.log(`Found root skill: ${skillName}`);

      const skillSubdir = join(repoPath, skillName);
      mkdirSync(skillSubdir, { recursive: true });

      const entries = readdirSync(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === skillName) continue;
        renameSync(join(repoPath, entry.name), join(skillSubdir, entry.name));
      }

      removeDir(join(repoPath, '.git'));

      warnScriptFiles(findScriptFiles(repoPath));
      console.log(`✓ Installed 1 skill to ${repoPath}`);
      saveGitCloneSource(source, repoPath, options, resolvedOwner, resolvedRepo);
      return;
    }
  }

  if (skills.length === 0) {
    console.error('Error: No skills found in repository');
    process.exit(1);
  }

  console.log(`Found ${skills.length} skills.\n`);

  if (options.all) {
    warnScriptFiles(findScriptFiles(repoPath));
    console.log(`✓ Installed ${skills.length} skills to ${repoPath}`);
    saveGitCloneSource(source, repoPath, options);
    return;
  }

  const selectedNames = await promptSkillsToInstall(skills);
  if (selectedNames.length === 0) {
    console.log('No skills selected');
    // Remove the cloned repo since nothing was selected
    removeDir(repoPath);
    return;
  }

  // Remove unselected skills
  const unselectedSkills = skills.filter((s) => !selectedNames.includes(s.name));
  for (const skill of unselectedSkills) {
    removeDir(skill.path);
  }

  warnScriptFiles(findScriptFiles(repoPath));
  console.log(`\n✓ Installed ${selectedNames.length} skills to ${repoPath}`);
  saveGitCloneSource(source, repoPath, options);
}

/**
 * Save source info for git clone installs
 */
function saveGitCloneSource(
  source: string,
  repoPath: string,
  options: InstallOptions,
  resolvedOwner?: string,
  resolvedRepo?: string
): void {
  const repoName = repoPath.split('/').pop() || source;

  let type: 'official' | 'community' | 'custom';
  let sourceKey: string;

  const officialKey = resolvedOwner && resolvedRepo
    ? findOfficialProvider(resolvedOwner, resolvedRepo)
    : null;

  if (officialKey || repoPath.includes('/official/')) {
    type = 'official';
    sourceKey = `official/${officialKey || repoName}`;
  } else if (options.custom || repoPath.includes('/custom/')) {
    type = 'custom';
    sourceKey = `custom/${repoName}`;
  } else {
    type = 'community';
    const owner = resolvedOwner || repoName;
    const repo = resolvedRepo || repoName;
    sourceKey = `community/${owner}/${repo}`;
  }

  let url = source;
  if (!source.startsWith('http')) {
    if (resolvedOwner && resolvedRepo) {
      url = `https://github.com/${resolvedOwner}/${resolvedRepo}`;
    } else {
      url = `https://github.com/${source}`;
    }
  }

  sourcesService.addSource(sourceKey, {
    url,
    type,
    repoName: officialKey || repoName,
  });
}

export async function executeInstall(
  source: string,
  options: InstallOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  try {
    // Check if input is an official provider shorthand
    if (OFFICIAL_PROVIDERS[source]) {
      await installFromOfficial(source, options);
      return;
    }

    // Support owner/repo shorthand (e.g., "Fission-AI/OpenSpec") → GitHub URL
    if (!source.includes('://') && /^[^/]+\/[^/]+\/?$/.test(source)) {
      const [shortOwner, shortRepo] = source.replace(/\/$/, '').split('/');
      const officialKey = findOfficialProvider(shortOwner, shortRepo);
      if (officialKey) {
        await installFromOfficial(officialKey, options);
        return;
      }
      source = `https://github.com/${source.replace(/\/$/, '')}`;
      console.log(`Resolved to ${source}`);
    }

    // Try GitHub API for GitHub URLs
    if (source.includes('github.com')) {
      const success = await installFromGitHubUrl(source, options);
      if (success) return;
      console.log('GitHub API failed, falling back to git clone...');
    }

    // Fall back to git clone
    await installViaGitClone(source, options);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export const installCommand = new Command('install')
  .alias('i')
  .description('Download skills from a repository')
  .argument('<source>', 'Provider name (anthropic/openai/microsoft/vercel-labs), owner/repo, or URL')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

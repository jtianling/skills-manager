import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitService } from '../services/git.js';
import { GitHubService } from '../services/github.js';
import { SourcesService } from '../services/sources.js';
import { InstallOptions } from '../types.js';
import { mkdirSync, readdirSync, renameSync } from 'fs';
import { fileExists, getDirectoriesInDir, getFilesInDir, readFileContent, removeDir, ensureDir } from '../utils/fs.js';
import { promptSkillsToInstall } from '../utils/prompts.js';
import { ProgressBar } from '../utils/progress.js';

const sourcesService = new SourcesService();

/**
 * Parse SKILL.md or command .md frontmatter to extract description
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
 * Install commands from a GitHub repo alongside skills
 */
async function installCommandsFromGitHub(
  githubService: GitHubService,
  owner: string,
  repo: string,
  targetBase: string,
  defaultBranch: string
): Promise<number> {
  // Try common commands directory locations
  const commandsPaths = ['commands', 'src/commands'];
  let commandsList: Array<{ name: string; path: string }> = [];

  for (const commandsPath of commandsPaths) {
    commandsList = await githubService.listCommands(owner, repo, commandsPath);
    if (commandsList.length > 0) break;
  }

  if (commandsList.length === 0) {
    return 0;
  }

  console.log(`\nFound ${commandsList.length} commands, installing...`);
  const commandsTargetDir = join(targetBase, 'commands');
  ensureDir(commandsTargetDir);

  for (const cmd of commandsList) {
    const targetPath = join(commandsTargetDir, cmd.name);
    process.stdout.write(`  ${cmd.name.replace(/\.md$/, '')}...`);
    await githubService.downloadCommandFile(owner, repo, cmd.path, targetPath);
    console.log(' ✓');
  }

  return commandsList.length;
}

/**
 * Install skills from Anthropic using GitHub API (efficient, no git clone)
 */
async function installFromAnthropic(options: InstallOptions): Promise<void> {
  const githubService = new GitHubService();
  const owner = 'anthropics';
  const repo = 'skills';

  console.log('Fetching available skills from anthropic/skills...');

  // List skills via API
  const skillsList = await githubService.listSkills(owner, repo, 'skills');

  // Get the default branch
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);
  const targetBase = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');

  // Also check for commands
  let commandsCount = 0;

  if (skillsList.length === 0) {
    // No skills, try commands only
    commandsCount = await installCommandsFromGitHub(
      githubService, owner, repo, targetBase, defaultBranch
    );
    if (commandsCount === 0) {
      console.error('Error: No skills or commands found in repository');
      process.exit(1);
    }
    console.log(`\n✓ Installed ${commandsCount} commands to ${targetBase}`);
    sourcesService.addSource('official/anthropic', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'anthropic',
    });
    return;
  }

  // Get skill descriptions by fetching SKILL.md for each
  const skills: Array<{ name: string; description: string; path: string }> = [];
  const progress = new ProgressBar(skillsList.length, 'Fetching skill info');
  progress.start();

  for (const skill of skillsList) {
    // Fetch SKILL.md content via API
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        const content = await response.text();
        const description = parseMdDescription(content);
        skills.push({
          name: skill.name,
          description,
          path: skill.path,
        });
      } else {
        skills.push({ name: skill.name, description: '', path: skill.path });
      }
    } catch {
      skills.push({ name: skill.name, description: '', path: skill.path });
    }
    progress.tick();
  }

  progress.complete();
  console.log(`Found ${skills.length} skills.\n`);

  let selectedSkills = skills;

  // If not --all, prompt for selection
  if (!options.all) {
    const selectedNames = await promptSkillsToInstall(skills);
    if (selectedNames.length === 0) {
      console.log('No skills selected');
      return;
    }
    selectedSkills = skills.filter((s) => selectedNames.includes(s.name));
  }

  // Download selected skills
  console.log(`\nDownloading ${selectedSkills.length} skills...`);

  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
  }

  // Also install commands automatically
  commandsCount = await installCommandsFromGitHub(
    githubService, owner, repo, targetBase, defaultBranch
  );

  const parts = [`${selectedSkills.length} skills`];
  if (commandsCount > 0) parts.push(`${commandsCount} commands`);
  console.log(`\n✓ Installed ${parts.join(' and ')} to ${targetBase}`);

  // Save source info
  sourcesService.addSource('official/anthropic', {
    url: 'https://github.com/anthropics/skills',
    type: 'official',
    repoName: 'anthropic',
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
  const isAnthropic = owner === 'anthropics' && repo === 'skills';

  // If it's a specific skill path (e.g., /tree/main/skills/code-review)
  if (path) {
    const skillName = path.split('/').pop() || path;
    const targetDir = githubService.getTargetDir(owner, repo, skillName, options.custom);

    console.log(`Downloading ${skillName}...`);
    await githubService.downloadSkill(owner, repo, path, targetDir);
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
  if (isAnthropic) {
    targetBase = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
  } else if (options.custom) {
    targetBase = join(SKILLS_MANAGER_DIR, 'custom', repo);
  } else {
    targetBase = join(SKILLS_MANAGER_DIR, 'community', repo);
  }

  // If no skills found, check root SKILL.md then try commands only
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

      const commandsCount = await installCommandsFromGitHub(
        githubService, owner, repo, targetBase, defaultBranch
      );

      const parts = ['1 skill'];
      if (commandsCount > 0) parts.push(`${commandsCount} commands`);
      console.log(`\n✓ Installed ${parts.join(' and ')} to ${targetBase}`);

      const sourceKey = isAnthropic
        ? 'official/anthropic'
        : options.custom
          ? `custom/${repo}`
          : `community/${repo}`;
      sourcesService.addSource(sourceKey, {
        url: `https://github.com/${owner}/${repo}`,
        type: isAnthropic ? 'official' : options.custom ? 'custom' : 'community',
        repoName: repo,
      });
      return true;
    }

    const commandsCount = await installCommandsFromGitHub(
      githubService, owner, repo, targetBase, defaultBranch
    );
    if (commandsCount === 0) {
      return false; // Fall back to git clone
    }

    console.log(`\n✓ Installed ${commandsCount} commands to ${targetBase}`);

    const sourceKey = isAnthropic
      ? 'official/anthropic'
      : options.custom
        ? `custom/${repo}`
        : `community/${repo}`;
    sourcesService.addSource(sourceKey, {
      url: `https://github.com/${owner}/${repo}`,
      type: isAnthropic ? 'official' : options.custom ? 'custom' : 'community',
      repoName: repo,
    });
    return true;
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

      const commandsCount = await installCommandsFromGitHub(
        githubService, owner, repo, targetBase, defaultBranch
      );

      const parts = ['1 skill'];
      if (commandsCount > 0) parts.push(`${commandsCount} commands`);
      console.log(`\n✓ Installed ${parts.join(' and ')} to ${targetBase}`);

      const sourceKey = isAnthropic
        ? 'official/anthropic'
        : options.custom
          ? `custom/${repo}`
          : `community/${repo}`;
      sourcesService.addSource(sourceKey, {
        url: `https://github.com/${owner}/${repo}`,
        type: isAnthropic ? 'official' : options.custom ? 'custom' : 'community',
        repoName: repo,
      });
      return true;
    }

    // No root skill either, try commands only
    const commandsCount = await installCommandsFromGitHub(
      githubService, owner, repo, targetBase, defaultBranch
    );
    if (commandsCount === 0) {
      return false;
    }
    console.log(`\n✓ Installed ${commandsCount} commands to ${targetBase}`);

    const sourceKey = isAnthropic
      ? 'official/anthropic'
      : options.custom
        ? `custom/${repo}`
        : `community/${repo}`;
    sourcesService.addSource(sourceKey, {
      url: `https://github.com/${owner}/${repo}`,
      type: isAnthropic ? 'official' : options.custom ? 'custom' : 'community',
      repoName: repo,
    });
    return true;
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

  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
  }

  // Also install commands automatically
  const commandsCount = await installCommandsFromGitHub(
    githubService, owner, repo, targetBase, defaultBranch
  );

  const parts = [`${selectedSkills.length} skills`];
  if (commandsCount > 0) parts.push(`${commandsCount} commands`);
  console.log(`\n✓ Installed ${parts.join(' and ')} to ${targetBase}`);

  // Save source info
  const sourceKey = isAnthropic
    ? 'official/anthropic'
    : options.custom
      ? `custom/${repo}`
      : `community/${repo}`;
  sourcesService.addSource(sourceKey, {
    url: `https://github.com/${owner}/${repo}`,
    type: isAnthropic ? 'official' : options.custom ? 'custom' : 'community',
    repoName: repo,
  });

  return true;
}

/**
 * Count commands found via git clone
 */
function countCommandsInRepo(repoPath: string): number {
  const commandsDirs = ['commands', 'src/commands'];
  for (const dir of commandsDirs) {
    const commandsDir = join(repoPath, dir);
    if (fileExists(commandsDir)) {
      const mdFiles = getFilesInDir(commandsDir, '.md');
      return mdFiles.length;
    }
  }
  return 0;
}

/**
 * Fall back to git clone for non-GitHub or failed API attempts
 */
async function installViaGitClone(
  source: string,
  options: InstallOptions
): Promise<void> {
  const gitService = new GitService();

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

      const commandsCount = countCommandsInRepo(skillSubdir);
      const parts = ['1 skill'];
      if (commandsCount > 0) parts.push(`${commandsCount} commands`);
      console.log(`✓ Installed ${parts.join(' and ')} to ${repoPath}`);
      saveGitCloneSource(source, repoPath, options);
      return;
    }
  }

  // Count commands in the repo
  const commandsCount = countCommandsInRepo(repoPath);

  if (skills.length === 0 && commandsCount === 0) {
    console.error('Error: No skills or commands found in repository');
    process.exit(1);
  }

  if (skills.length > 0) {
    console.log(`Found ${skills.length} skills.\n`);
  }
  if (commandsCount > 0) {
    console.log(`Found ${commandsCount} commands (will be installed automatically).\n`);
  }

  if (skills.length === 0) {
    // Commands only - already cloned
    console.log(`✓ Installed ${commandsCount} commands to ${repoPath}`);
    saveGitCloneSource(source, repoPath, options);
    return;
  }

  if (options.all) {
    const parts = [`${skills.length} skills`];
    if (commandsCount > 0) parts.push(`${commandsCount} commands`);
    console.log(`✓ Installed ${parts.join(' and ')} to ${repoPath}`);
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

  const parts = [`${selectedNames.length} skills`];
  if (commandsCount > 0) parts.push(`${commandsCount} commands`);
  console.log(`\n✓ Installed ${parts.join(' and ')} to ${repoPath}`);
  saveGitCloneSource(source, repoPath, options);
}

/**
 * Save source info for git clone installs
 */
function saveGitCloneSource(source: string, repoPath: string, options: InstallOptions): void {
  // Extract repo name from path
  const repoName = repoPath.split('/').pop() || source;

  // Determine type and key
  let type: 'official' | 'community' | 'custom';
  let sourceKey: string;

  if (source === 'anthropic' || repoPath.includes('/official/')) {
    type = 'official';
    sourceKey = 'official/anthropic';
  } else if (options.custom || repoPath.includes('/custom/')) {
    type = 'custom';
    sourceKey = `custom/${repoName}`;
  } else {
    type = 'community';
    sourceKey = `community/${repoName}`;
  }

  // Normalize URL
  let url = source;
  if (source === 'anthropic') {
    url = 'https://github.com/anthropics/skills';
  } else if (!source.startsWith('http')) {
    url = `https://github.com/${source}`;
  }

  sourcesService.addSource(sourceKey, {
    url,
    type,
    repoName,
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
    // Special handling for 'anthropic' - use efficient API download
    if (source === 'anthropic') {
      await installFromAnthropic(options);
      return;
    }

    // Support owner/repo shorthand (e.g., "Fission-AI/OpenSpec") → GitHub URL
    if (!source.includes('://') && /^[^/]+\/[^/]+\/?$/.test(source)) {
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
  .description('Download skills and commands from a repository')
  .argument('<source>', 'Repository URL or "anthropic" for official skills')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitService } from '../services/git.js';
import { GitHubService } from '../services/github.js';
import { SkillsService } from '../services/skills.js';
import { InstallOptions } from '../types.js';
import { fileExists, getDirectoriesInDir, readFileContent, removeDir } from '../utils/fs.js';
import { promptSkillsToInstall } from '../utils/prompts.js';
import { ProgressBar } from '../utils/progress.js';

/**
 * Parse SKILL.md frontmatter to extract description
 */
function parseSkillDescription(content: string): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return '';
  }
  const descMatch = frontmatterMatch[1].match(/^description:\s*(.+)$/m);
  return descMatch ? descMatch[1].trim() : '';
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

  if (skillsList.length === 0) {
    console.log('No skills found in repository');
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
        `https://raw.githubusercontent.com/${owner}/${repo}/main/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        const content = await response.text();
        const description = parseSkillDescription(content);
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
  const targetBase = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');

  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
  }

  console.log(`\n✓ Installed ${selectedSkills.length} skills to ${targetBase}`);
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
  console.log(`Fetching available skills from ${owner}/${repo}...`);

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

  if (skillsList.length === 0) {
    return false; // Fall back to git clone
  }

  // Filter to only directories that have SKILL.md
  const skills: Array<{ name: string; description: string; path: string }> = [];
  const progress = new ProgressBar(skillsList.length, 'Fetching skill info');
  progress.start();

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/main/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        const content = await response.text();
        const description = parseSkillDescription(content);
        skills.push({ name: skill.name, description, path: skill.path });
      }
    } catch {
      // Skip skills without SKILL.md
    }
    progress.tick();
  }

  progress.complete();

  if (skills.length === 0) {
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

  let targetBase: string;
  if (isAnthropic) {
    targetBase = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
  } else if (options.custom) {
    targetBase = join(SKILLS_MANAGER_DIR, 'custom', repo);
  } else {
    targetBase = join(SKILLS_MANAGER_DIR, 'community', repo);
  }

  for (const skill of selectedSkills) {
    const targetDir = join(targetBase, skill.name);
    process.stdout.write(`  ${skill.name}...`);
    await githubService.downloadSkill(owner, repo, skill.path, targetDir);
    console.log(' ✓');
  }

  console.log(`\n✓ Installed ${selectedSkills.length} skills to ${targetBase}`);
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

  // Find all skills in the repo
  let skillsRoot = repoPath;
  if (source === 'anthropic') {
    const skillsSubdir = join(repoPath, 'skills');
    if (fileExists(skillsSubdir)) {
      skillsRoot = skillsSubdir;
    }
  }

  const skillDirs = getDirectoriesInDir(skillsRoot);
  const skills: Array<{ name: string; description: string; path: string }> = [];

  for (const dir of skillDirs) {
    const skillMdPath = join(dir.path, 'SKILL.md');
    if (fileExists(skillMdPath)) {
      const content = readFileContent(skillMdPath);
      const description = parseSkillDescription(content);
      skills.push({
        name: dir.name,
        description,
        path: dir.path,
      });
    }
  }

  if (skills.length === 0) {
    console.log('No skills found in repository');
    return;
  }

  console.log(`Found ${skills.length} skills.\n`);

  if (options.all) {
    console.log(`✓ Installed ${skills.length} skills to ${repoPath}`);
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

  console.log(`\n✓ Installed ${selectedNames.length} skills to ${repoPath}`);
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
  .description('Download skills from a repository')
  .argument('<source>', 'Repository URL or "anthropic" for official skills')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

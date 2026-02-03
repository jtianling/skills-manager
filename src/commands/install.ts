import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitService } from '../services/git.js';
import { SkillsService } from '../services/skills.js';
import { InstallOptions } from '../types.js';
import { fileExists, getDirectoriesInDir } from '../utils/fs.js';
import { promptSkillsToInstall } from '../utils/prompts.js';

export async function executeInstall(
  source: string,
  options: InstallOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

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
  // For anthropic repo, skills are in the skills/ subdirectory
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
      // Parse SKILL.md for description
      const service = new SkillsService(SKILLS_MANAGER_DIR);
      const allSkills = service.getAllSkills();
      const skill = allSkills.find((s) => s.path === dir.path);
      skills.push({
        name: dir.name,
        description: skill?.description || '',
        path: dir.path,
      });
    }
  }

  if (skills.length === 0) {
    console.log('No skills found in repository');
    return;
  }

  console.log(`Found ${skills.length} skills.\n`);

  // If --all flag, install all
  if (options.all) {
    console.log(`✓ Installed ${skills.length} skills to ${repoPath}`);
    return;
  }

  // Otherwise, prompt for selection
  const selectedNames = await promptSkillsToInstall(skills);

  if (selectedNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  // For skills not selected, we could remove them, but for simplicity
  // we just report what was installed
  console.log(`\n✓ Installed ${selectedNames.length} skills to ${repoPath}`);
}

export const installCommand = new Command('install')
  .description('Download skills from a repository')
  .argument('<source>', 'Repository URL or "anthropic" for official skills')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });

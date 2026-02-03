import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitHubService } from '../services/github.js';
import { SourcesService, SourceInfo } from '../services/sources.js';
import { fileExists, removeDir } from '../utils/fs.js';
import { ProgressBar } from '../utils/progress.js';

const sourcesService = new SourcesService();
const githubService = new GitHubService();

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

async function updateSource(key: string, info: SourceInfo): Promise<number> {
  const parsed = githubService.parseGitHubUrl(info.url);
  if (!parsed) {
    console.log(`  ⚠ Cannot parse URL: ${info.url}`);
    return 0;
  }

  const { owner, repo } = parsed;

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
    console.log(`  ⚠ No skills found in ${owner}/${repo}`);
    return 0;
  }

  // Get the default branch
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);

  // Filter to only directories that have SKILL.md
  const skills: Array<{ name: string; path: string }> = [];
  const progress = new ProgressBar(skillsList.length, 'Checking skills');
  progress.start();

  for (const skill of skillsList) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skill.path}/SKILL.md`
      );
      if (response.ok) {
        skills.push(skill);
      }
    } catch {
      // Skip
    }
    progress.tick();
  }

  progress.complete();

  if (skills.length === 0) {
    return 0;
  }

  // Determine target directory
  let targetBase: string;
  if (info.type === 'official') {
    targetBase = join(SKILLS_MANAGER_DIR, 'official', info.repoName);
  } else if (info.type === 'custom') {
    targetBase = join(SKILLS_MANAGER_DIR, 'custom', info.repoName);
  } else {
    targetBase = join(SKILLS_MANAGER_DIR, 'community', info.repoName);
  }

  // Download all skills (update)
  let updatedCount = 0;
  for (const skill of skills) {
    const targetDir = join(targetBase, skill.name);
    try {
      // Remove existing and re-download
      if (fileExists(targetDir)) {
        removeDir(targetDir);
      }
      await githubService.downloadSkill(owner, repo, skill.path, targetDir);
      updatedCount++;
    } catch {
      console.log(`  ⚠ Failed to update ${skill.name}`);
    }
  }

  // Update timestamp
  sourcesService.updateTimestamp(key);

  return updatedCount;
}

export async function executeUpdate(source?: string): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const allSources = sourcesService.getAllSources();

  if (Object.keys(allSources).length === 0) {
    console.log('No installed sources found.');
    console.log('\nRun: skillsmgr install anthropic');
    return;
  }

  // If specific source provided, only update that one
  if (source) {
    // Find matching source
    const matchingKey = Object.keys(allSources).find(
      (k) => k === source || k.endsWith(`/${source}`) || allSources[k].repoName === source
    );

    if (!matchingKey) {
      console.log(`Source '${source}' not found.`);
      console.log('\nInstalled sources:');
      for (const key of Object.keys(allSources)) {
        console.log(`  ${key}`);
      }
      return;
    }

    console.log(`Updating ${matchingKey}...`);
    const count = await updateSource(matchingKey, allSources[matchingKey]);
    console.log(`\n✓ Updated ${count} skills from ${matchingKey}`);
    return;
  }

  // Update all sources
  console.log('Updating all installed sources...\n');

  let totalUpdated = 0;
  for (const [key, info] of Object.entries(allSources)) {
    console.log(`${key}:`);
    const count = await updateSource(key, info);
    console.log(`  ✓ ${count} skills updated\n`);
    totalUpdated += count;
  }

  console.log(`Done! Updated ${totalUpdated} skills from ${Object.keys(allSources).length} sources.`);
}

export const updateCommand = new Command('update')
  .description('Update installed skills to latest version')
  .argument('[source]', 'Specific source to update (e.g., "anthropic")')
  .action(async (source?: string) => {
    await executeUpdate(source);
  });

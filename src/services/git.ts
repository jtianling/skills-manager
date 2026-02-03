import { execSync } from 'child_process';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { ANTHROPIC_SKILLS_REPO, SKILLS_MANAGER_DIR } from '../constants.js';
import { ensureDir } from '../utils/fs.js';

export class GitService {
  /**
   * Clone a git repository to the skills manager directory
   * @param url Git URL or 'anthropic' shorthand
   * @param isCustom Whether to install to custom/ instead of community/
   * @returns Path where repo was cloned
   */
  clone(url: string, isCustom: boolean = false): string {
    const actualUrl = url === 'anthropic' ? ANTHROPIC_SKILLS_REPO : url;
    const repoName = this.extractRepoName(actualUrl);

    // Determine target directory
    let targetDir: string;
    if (url === 'anthropic') {
      targetDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
    } else if (isCustom) {
      targetDir = join(SKILLS_MANAGER_DIR, 'custom', repoName);
    } else {
      targetDir = join(SKILLS_MANAGER_DIR, 'community', repoName);
    }

    // If already exists, do a pull instead
    if (existsSync(targetDir)) {
      console.log(`Updating existing ${repoName}...`);
      execSync('git pull', { cwd: targetDir, stdio: 'inherit' });
      return targetDir;
    }

    // Clone the repo
    ensureDir(join(targetDir, '..'));
    console.log(`Cloning ${repoName}...`);
    execSync(`git clone --depth 1 "${actualUrl}" "${targetDir}"`, {
      stdio: 'inherit',
    });

    return targetDir;
  }

  /**
   * Clone a specific skill from a repository
   * @param url Git URL with path to specific skill (e.g., https://github.com/org/repo/tree/main/skill-name)
   * @param isCustom Whether to install to custom/
   * @returns Path where skill was cloned
   */
  cloneSpecificSkill(url: string, isCustom: boolean = false): string | null {
    // Parse GitHub tree URL
    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
    );
    if (!match) {
      return null;
    }

    const [, owner, repo, branch, skillPath] = match;
    const skillName = basename(skillPath);
    const repoUrl = `https://github.com/${owner}/${repo}`;

    // Determine if this is the official anthropic repo
    const isAnthropic = owner === 'anthropics' && repo === 'skills';

    let targetDir: string;
    if (isAnthropic) {
      targetDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
    } else if (isCustom) {
      targetDir = join(SKILLS_MANAGER_DIR, 'custom', repo);
    } else {
      targetDir = join(SKILLS_MANAGER_DIR, 'community', repo);
    }

    const skillTargetDir = join(targetDir, skillName);

    // Use sparse checkout to get only the specific skill
    ensureDir(targetDir);

    if (!existsSync(join(targetDir, '.git'))) {
      execSync(`git init`, { cwd: targetDir, stdio: 'pipe' });
      execSync(`git remote add origin "${repoUrl}"`, {
        cwd: targetDir,
        stdio: 'pipe',
      });
    }

    execSync(`git config core.sparseCheckout true`, {
      cwd: targetDir,
      stdio: 'pipe',
    });
    execSync(`echo "${skillPath}" >> .git/info/sparse-checkout`, {
      cwd: targetDir,
      stdio: 'pipe',
    });
    execSync(`git pull --depth 1 origin ${branch}`, {
      cwd: targetDir,
      stdio: 'inherit',
    });

    return skillTargetDir;
  }

  private extractRepoName(url: string): string {
    // Handle various URL formats
    const match = url.match(/\/([^/]+?)(\.git)?$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Check if a URL points to a specific skill (vs a repository)
   */
  isSpecificSkillUrl(url: string): boolean {
    return url.includes('/tree/');
  }
}

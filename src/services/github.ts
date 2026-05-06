import { join } from 'path';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';

export class GitHubService {
  /**
   * Get the target directory for a skill based on source
   */
  getTargetDir(
    owner: string,
    repo: string,
    skillName: string,
    isCustom: boolean = false
  ): string {
    const providerKey = findOfficialProvider(owner);

    let baseDir: string;
    if (providerKey) {
      baseDir = join(SKILLS_MANAGER_DIR, 'official', providerKey, repo);
    } else if (isCustom) {
      baseDir = join(SKILLS_MANAGER_DIR, 'custom', repo);
    } else {
      baseDir = join(SKILLS_MANAGER_DIR, 'community', owner, repo);
    }

    return join(baseDir, skillName);
  }

  /**
   * Parse a GitHub URL to extract owner, repo, and optional path
   */
  parseGitHubUrl(url: string): {
    owner: string;
    repo: string;
    path?: string;
    branch?: string;
  } | null {
    // Handle tree URLs: https://github.com/owner/repo/tree/branch/path
    const treeMatch = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?/
    );
    if (treeMatch) {
      return {
        owner: treeMatch[1],
        repo: treeMatch[2],
        branch: treeMatch[3],
        path: treeMatch[4],
      };
    }

    // Handle basic URLs: https://github.com/owner/repo
    const basicMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (basicMatch) {
      return {
        owner: basicMatch[1],
        repo: basicMatch[2],
      };
    }

    return null;
  }
}

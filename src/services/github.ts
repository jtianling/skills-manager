import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { ensureDir } from '../utils/fs.js';

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  sha: string;
}

export class GitHubService {
  private baseApiUrl = 'https://api.github.com';
  private defaultBranchCache: Map<string, string> = new Map();

  /**
   * Get the default branch for a repository
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const cacheKey = `${owner}/${repo}`;
    if (this.defaultBranchCache.has(cacheKey)) {
      return this.defaultBranchCache.get(cacheKey)!;
    }

    const url = `${this.baseApiUrl}/repos/${owner}/${repo}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      return 'main'; // Fallback to main
    }

    const data = await response.json();
    const branch = data.default_branch || 'main';
    this.defaultBranchCache.set(cacheKey, branch);
    return branch;
  }

  /**
   * List skills in a GitHub repository's skills directory
   */
  async listSkills(
    owner: string,
    repo: string,
    skillsPath: string = 'skills'
  ): Promise<Array<{ name: string; path: string }>> {
    const url = `${this.baseApiUrl}/repos/${owner}/${repo}/contents/${skillsPath}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list skills: ${response.statusText}`);
    }

    const contents: GitHubContent[] = await response.json();
    return contents
      .filter((item) => item.type === 'dir')
      .map((item) => ({ name: item.name, path: item.path }));
  }

  /**
   * Download a specific skill directory from GitHub
   */
  async downloadSkill(
    owner: string,
    repo: string,
    skillPath: string,
    targetDir: string
  ): Promise<void> {
    ensureDir(targetDir);
    await this.downloadDirectory(owner, repo, skillPath, targetDir);
  }

  /**
   * Download all files in a directory recursively
   */
  private async downloadDirectory(
    owner: string,
    repo: string,
    path: string,
    targetDir: string
  ): Promise<void> {
    const url = `${this.baseApiUrl}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to download directory: ${response.statusText}`);
    }

    const contents: GitHubContent[] = await response.json();

    for (const item of contents) {
      const localPath = join(targetDir, item.name);

      if (item.type === 'file' && item.download_url) {
        await this.downloadFile(item.download_url, localPath);
      } else if (item.type === 'dir') {
        mkdirSync(localPath, { recursive: true });
        await this.downloadDirectory(owner, repo, item.path, localPath);
      }
    }
  }

  /**
   * Download a single file
   */
  private async downloadFile(url: string, localPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const content = await response.text();
    writeFileSync(localPath, content, 'utf-8');
  }

  /**
   * Get the target directory for a skill based on source
   */
  getTargetDir(
    owner: string,
    repo: string,
    skillName: string,
    isCustom: boolean = false
  ): string {
    const isAnthropic = owner === 'anthropics' && repo === 'skills';

    let baseDir: string;
    if (isAnthropic) {
      baseDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
    } else if (isCustom) {
      baseDir = join(SKILLS_MANAGER_DIR, 'custom', repo);
    } else {
      baseDir = join(SKILLS_MANAGER_DIR, 'community', repo);
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

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'skillsmgr',
    };

    // Use GitHub token if available for higher rate limits
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    return headers;
  }
}

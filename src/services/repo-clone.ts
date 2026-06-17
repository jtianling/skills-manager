import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { STANDARD_SKILL_PATHS } from '../constants.js';
import {
  fileExists,
  getDirectoriesInDir,
  readFileContent,
} from '../utils/fs.js';
import {
  parseMdDescription,
  parseMdFrontmatter,
  type InstallableSkill,
} from '../commands/install-utils.js';
import { getPluginSkillPaths } from './plugin-manifest.js';
import {
  ArchiveAuthError,
  buildArchiveUrl,
  downloadAndExtractArchive,
  isGitAvailable,
} from './github-archive.js';

export interface ClonedRepo {
  repoPath: string;
  commitSha?: string;
  cleanup(): void;
}

interface GitHubRef {
  owner: string;
  repo: string;
  ref?: string;
}

/** Parse a GitHub source string into owner/repo/ref for codeload download. */
function parseGitHubRef(source: string): GitHubRef | null {
  const treeMatch = source.match(
    /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/tree\/([^/]+)(?:\/.*)?$/,
  );
  if (treeMatch) {
    return { owner: treeMatch[1], repo: treeMatch[2], ref: treeMatch[3] };
  }

  const repoMatch = source.match(
    /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  );
  if (repoMatch) {
    return { owner: repoMatch[1], repo: repoMatch[2] };
  }

  const shorthand = source.match(/^([^/]+)\/([^/]+?)\/?$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2] };
  }

  return null;
}

function makeTempRepoDir(): { tempDir: string; repoPath: string } {
  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-git-'));
  const repoPath = join(tempDir, 'repo');
  mkdirSync(repoPath, { recursive: true });
  return { tempDir, repoPath };
}

function cloneViaGit(source: string, tempDir: string, repoPath: string): ClonedRepo {
  if (!isGitAvailable()) {
    rmSync(tempDir, { recursive: true, force: true });
    throw new Error(
      'Installing this repository requires git, but no usable `git` binary ' +
      'was found on PATH. Public repos install without git via codeload; ' +
      'private or inaccessible repos need local git or access credentials.',
    );
  }

  try {
    rmSync(repoPath, { recursive: true, force: true });
    execFileSync('git', ['clone', '--depth', '1', source, repoPath], { stdio: 'pipe' });
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }

  let commitSha: string | undefined;
  try {
    commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoPath,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim() || undefined;
  } catch {
    commitSha = undefined;
  }

  return {
    repoPath,
    commitSha,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

export async function cloneRepoToTemp(source: string): Promise<ClonedRepo> {
  const parsed = parseGitHubRef(source);
  const { tempDir, repoPath } = makeTempRepoDir();

  if (!parsed) {
    return cloneViaGit(source, tempDir, repoPath);
  }

  const archiveUrl = buildArchiveUrl(parsed.owner, parsed.repo, parsed.ref);
  try {
    // Default HEAD path always yields an immutable sha (fail-closed); an
    // explicit branch ref resolves to refs/heads/<branch> with no sha.
    const { commitSha } = await downloadAndExtractArchive(archiveUrl, repoPath, {
      requireSha: !parsed.ref,
    });
    return {
      repoPath,
      commitSha,
      cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
    };
  } catch (error) {
    if (error instanceof ArchiveAuthError) {
      return cloneViaGit(source, tempDir, repoPath);
    }
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function discoverManifestSkills(repoPath: string): InstallableSkill[] {
  const manifestDirs = getPluginSkillPaths(repoPath);
  if (manifestDirs.length === 0) {
    return [];
  }

  const skills: InstallableSkill[] = [];
  const seen = new Set<string>();
  for (const dir of manifestDirs) {
    for (const skill of scanSkillDirectories(dir)) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        skills.push(skill);
      }
    }
  }
  return skills;
}

function scanSkillDirectories(dir: string, maxDepth = 4): InstallableSkill[] {
  const skills: InstallableSkill[] = [];
  if (!fileExists(dir)) return skills;

  for (const subdir of getDirectoriesInDir(dir)) {
    const skillMd = join(subdir.path, 'SKILL.md');
    if (fileExists(skillMd)) {
      const content = readFileContent(skillMd);
      const frontmatter = parseMdFrontmatter(content);
      skills.push({
        name: frontmatter.name || subdir.name,
        description: parseMdDescription(content),
        path: subdir.path,
      });
    } else if (maxDepth > 1) {
      skills.push(...scanSkillDirectories(subdir.path, maxDepth - 1));
    }
  }
  return skills;
}

function mergeSkills(base: InstallableSkill[], extra: InstallableSkill[]): InstallableSkill[] {
  const seen = new Set(base.map((s) => s.name));
  const merged = [...base];
  for (const skill of extra) {
    if (!seen.has(skill.name)) {
      seen.add(skill.name);
      merged.push(skill);
    }
  }
  return merged;
}

function scanForRootSkills(dir: string, maxDepth: number): InstallableSkill[] {
  const skills: InstallableSkill[] = [];
  for (const subdir of getDirectoriesInDir(dir)) {
    const skillMd = join(subdir.path, 'SKILL.md');
    if (fileExists(skillMd)) {
      const content = readFileContent(skillMd);
      skills.push({ name: subdir.name, description: parseMdDescription(content), path: subdir.path });
    } else if (maxDepth > 1) {
      skills.push(...scanForRootSkills(subdir.path, maxDepth - 1));
    }
  }
  return skills;
}

export function collectSkillsFromClone(repoPath: string): InstallableSkill[] {
  const manifestSkills = discoverManifestSkills(repoPath);

  let scanned: InstallableSkill[] = [];
  for (const stdPath of STANDARD_SKILL_PATHS) {
    const dir = join(repoPath, stdPath);
    if (fileExists(dir)) {
      scanned = mergeSkills(scanned, scanForRootSkills(dir, 3));
    }
  }

  let skills = mergeSkills(manifestSkills, scanned);

  if (skills.length === 0) {
    const rootSkillMd = join(repoPath, 'SKILL.md');
    if (fileExists(rootSkillMd)) {
      const nested = scanForRootSkills(repoPath, 3);
      if (nested.length > 0) {
        skills = nested;
      } else {
        const content = readFileContent(rootSkillMd);
        const frontmatter = parseMdFrontmatter(content);
        skills = [{
          name: frontmatter.name || basename(repoPath),
          description: frontmatter.description ?? '',
          path: repoPath,
        }];
      }
    } else {
      skills = scanForRootSkills(repoPath, 3);
    }
  }

  return skills;
}

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
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

export interface ClonedRepo {
  repoPath: string;
  cleanup(): void;
}

export async function cloneRepoToTemp(source: string): Promise<ClonedRepo> {
  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-git-'));
  const repoPath = join(tempDir, 'repo');
  try {
    execFileSync('git', ['clone', '--depth', '1', source, repoPath], { stdio: 'pipe' });
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    repoPath,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
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

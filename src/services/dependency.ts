import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { fileExists, readFileContent } from '../utils/fs.js';
import type { SkillManifest } from '../types.js';

const MAX_DEPTH = 10;
const GITHUB_SKILL_PATTERN = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*):(.+)$/;
const GITHUB_REPO_PATTERN = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*)$/;

export interface RegistryDependency {
  type: 'registry';
  packageName: string;
}

export interface GitHubSkillDependency {
  type: 'github-skill';
  owner: string;
  repo: string;
  skillName: string;
}

export interface GitHubRepoDependency {
  type: 'github-repo';
  owner: string;
  repo: string;
}

export type ParsedDependency = RegistryDependency | GitHubSkillDependency | GitHubRepoDependency;

export function parseDependencyIdentifier(dep: string): ParsedDependency {
  // owner/repo:skillName
  const ghSkillMatch = dep.match(GITHUB_SKILL_PATTERN);
  if (ghSkillMatch) {
    return {
      type: 'github-skill',
      owner: ghSkillMatch[1],
      repo: ghSkillMatch[2],
      skillName: ghSkillMatch[3],
    };
  }

  // owner/repo
  const ghRepoMatch = dep.match(GITHUB_REPO_PATTERN);
  if (ghRepoMatch) {
    return {
      type: 'github-repo',
      owner: ghRepoMatch[1],
      repo: ghRepoMatch[2],
    };
  }

  // bare package name (registry)
  return {
    type: 'registry',
    packageName: dep,
  };
}

export function isDependencyInstalled(dep: ParsedDependency): boolean {
  switch (dep.type) {
    case 'registry':
      return fileExists(join(SKILLS_MANAGER_DIR, 'registry', dep.packageName));
    case 'github-repo': {
      // Check community, official, and custom dirs
      const communityDir = join(SKILLS_MANAGER_DIR, 'community', dep.owner, dep.repo);
      const officialDir = join(SKILLS_MANAGER_DIR, 'official', dep.owner, dep.repo);
      return fileExists(communityDir) || fileExists(officialDir);
    }
    case 'github-skill': {
      // Check community, official dirs for the specific skill
      const communitySkill = join(SKILLS_MANAGER_DIR, 'community', dep.owner, dep.repo, dep.skillName);
      const officialSkill = join(SKILLS_MANAGER_DIR, 'official', dep.owner, dep.repo, dep.skillName);
      return fileExists(communitySkill) || fileExists(officialSkill);
    }
  }
}

export interface ResolveOptions {
  installRegistryDep: (packageName: string) => Promise<string[]>;
  installGitHubRepoDep: (owner: string, repo: string) => Promise<void>;
  installGitHubSkillDep: (owner: string, repo: string, skillName: string) => Promise<void>;
  readInstalledManifest: (dep: ParsedDependency) => SkillManifest | null;
}

export async function resolveDependencies(
  dependencies: string[],
  parentName: string,
  options: ResolveOptions,
  installing: Set<string> = new Set(),
  depth: number = 0,
): Promise<void> {
  if (depth > MAX_DEPTH) {
    throw new Error('Dependency chain too deep (max 10 levels)');
  }

  for (const dep of dependencies) {
    const parsed = parseDependencyIdentifier(dep);
    const depKey = dep;

    // Circular dependency detection
    if (installing.has(depKey)) {
      const chain = [...installing, depKey];
      throw new Error(`Circular dependency detected: ${chain.join(' → ')}`);
    }

    // Skip already installed
    if (isDependencyInstalled(parsed)) {
      console.log(`  ⊘ ${dep} already installed, skipping`);
      continue;
    }

    installing.add(depKey);

    try {
      let installedDeps: string[] = [];

      switch (parsed.type) {
        case 'registry': {
          installedDeps = await options.installRegistryDep(parsed.packageName);
          break;
        }
        case 'github-repo': {
          await options.installGitHubRepoDep(parsed.owner, parsed.repo);
          break;
        }
        case 'github-skill': {
          await options.installGitHubSkillDep(parsed.owner, parsed.repo, parsed.skillName);
          break;
        }
      }

      console.log(`  ✓ Installed ${dep} (dependency of ${parentName})`);

      // Recursively resolve sub-dependencies
      const manifest = options.readInstalledManifest(parsed);
      if (manifest?.dependencies && manifest.dependencies.length > 0) {
        await resolveDependencies(
          manifest.dependencies,
          dep,
          options,
          installing,
          depth + 1,
        );
      }

      // Remove from path after processing (allow diamond deps)
      installing.delete(depKey);
    } catch (error) {
      installing.delete(depKey);
      // Rethrow critical resolution errors
      if (error instanceof Error &&
          (error.message.includes('Circular dependency detected') ||
           error.message.includes('Dependency chain too deep'))) {
        throw error;
      }
      console.warn(`  ⚠ Failed to install dependency "${dep}": ${error instanceof Error ? error.message : error}`);
    }
  }
}

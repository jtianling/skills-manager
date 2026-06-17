import { join } from 'path';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { GitHubService } from './github.js';
import { GroupsService } from './groups.js';
import { SourcesService } from './sources.js';
import { cloneRepoToTemp, collectSkillsFromClone } from './repo-clone.js';
import { Bundle, RemoteBundleInfo } from '../types.js';
import {
  cleanEmptyParents,
  copyDir,
  fileExists,
  findScriptFiles,
  getDirectoriesInDir,
  readFileContent,
  removeDir,
  warnScriptFiles,
} from '../utils/fs.js';

export interface BundleSyncResult {
  updated: number;
  upToDate: number;
  added: number;
  addedSkipped: number;
  removedKept: number;
  removedHard: number;
  failed: number;
}

export interface BundleRemoveResult {
  removed: number;
}

export interface BundleSyncOptions {
  sync?: boolean;
  verbose?: boolean;
}

interface BundleListing {
  /** Map of skill name → absolute path inside the cloned repo. */
  skills: Map<string, string>;
  commitSha?: string;
  cleanup(): void;
}

export type CloneFetcher = (url: string) => Promise<{
  repoPath: string;
  commitSha?: string;
  cleanup(): void;
}>;

export type SkillScanner = (repoPath: string) => Array<{ name: string; path: string }>;

interface BundleManagerFs {
  fileExists(path: string): boolean;
  readFileContent(path: string): string;
  removeDir(path: string): void;
  getDirectoriesInDir(path: string): Array<{ name: string; path: string }>;
}

const defaultFs: BundleManagerFs = {
  fileExists,
  readFileContent,
  removeDir,
  getDirectoriesInDir,
};

function createEmptySyncResult(): BundleSyncResult {
  return {
    updated: 0,
    upToDate: 0,
    added: 0,
    addedSkipped: 0,
    removedKept: 0,
    removedHard: 0,
    failed: 0,
  };
}

function getSkillNameFromSourceKey(sourceKey: string): string {
  const parts = sourceKey.split('/');
  return parts[parts.length - 1] ?? sourceKey;
}

export class BundleManager {
  constructor(
    private readonly sourcesService: SourcesService = new SourcesService(),
    private readonly githubService: GitHubService = new GitHubService(),
    private readonly groupsService: GroupsService = new GroupsService(),
    private readonly fs: BundleManagerFs = defaultFs,
    private readonly cloneRepo: CloneFetcher = cloneRepoToTemp,
    private readonly scanSkills: SkillScanner = (repoPath) =>
      collectSkillsFromClone(repoPath).map((s) => ({ name: s.name, path: s.path })),
  ) {}

  async sync(bundleId: string, options: BundleSyncOptions = {}): Promise<BundleSyncResult> {
    const bundle = this.sourcesService.getBundle(bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`);
    }

    if (bundle.type === 'local-batch') {
      throw new Error(
        'local-batch bundles are managed as physical groups. Use group update or update <group> instead.',
      );
    }

    if (bundle.type === 'zip') {
      console.log('  zip bundle update not supported, reinstall required');
      this.sourcesService.updateBundleTimestamp(bundleId);
      return createEmptySyncResult();
    }

    const remoteBundle = bundle as RemoteBundleInfo;
    if (remoteBundle.type !== 'git') {
      throw new Error(`Unsupported bundle type for sync: ${remoteBundle.type}`);
    }

    const listing = await this.cloneAndScan(remoteBundle);
    try {
      const currentSkills = [...listing.skills.keys()].sort();
      const installedNames = this.getInstalledSkillNames(remoteBundle);
      const diff = this.computeDiff(currentSkills, installedNames);
      const result = createEmptySyncResult();
      const primarySourceKey = this.getPrimarySourceKey(remoteBundle);

      for (const skillName of diff.existing) {
        try {
          const changed = this.applyExisting(remoteBundle, skillName, listing);
          if (changed) {
            result.updated++;
            console.log(`  ↑ ${skillName}: updated`);
          } else {
            result.upToDate++;
            if (options.verbose) {
              console.log(`  ✓ ${skillName}: up to date`);
            }
          }
        } catch (error) {
          result.failed++;
          console.log(`  ✗ ${skillName}: failed to update (${(error as Error).message})`);
        }
      }

      for (const skillName of diff.added) {
        try {
          if (bundle.selectionMode === 'subset') {
            result.addedSkipped++;
            console.log(`  + ${skillName}: new in source (skipped, subset mode)`);
            continue;
          }

          this.applyAdded(remoteBundle, skillName, primarySourceKey, listing);
          result.added++;
          console.log(`  + ${skillName}: new in source (installed)`);
        } catch (error) {
          result.failed++;
          console.log(`  ✗ ${skillName}: failed to install (${(error as Error).message})`);
        }
      }

      for (const skillName of diff.removed) {
        try {
          if (options.sync) {
            this.applyRemoved(remoteBundle, skillName, primarySourceKey);
            result.removedHard++;
            console.log(`  - ${skillName}: removed`);
            continue;
          }

          result.removedKept++;
          console.log(`  - ${skillName}: removed from source (kept locally, use --sync to remove)`);
        } catch {
          result.failed++;
          console.log(`  ✗ ${skillName}: failed to update`);
        }
      }

      if (!options.verbose && result.upToDate > 0) {
        console.log(`  ✓ ${result.upToDate} skills up to date`);
      }

      if (listing.commitSha && primarySourceKey) {
        this.sourcesService.updateVersion(primarySourceKey, listing.commitSha);
      }

      this.sourcesService.updateBundleTimestamp(bundleId);

      return result;
    } finally {
      listing.cleanup();
    }
  }

  async remove(bundleId: string): Promise<BundleRemoveResult> {
    const bundle = this.sourcesService.getBundle(bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`);
    }

    if (bundle.type === 'local-batch') {
      throw new Error(
        'local-batch bundles are managed as physical groups. Use group uninstall or uninstall <group> instead.',
      );
    }

    const remoteBundle = bundle as RemoteBundleInfo;
    let removed = 0;

    if (remoteBundle.type === 'git') {
      const targetBase = this.getGitTargetBase(remoteBundle);
      const sourceKey = this.getPrimarySourceKey(remoteBundle);
      if (!sourceKey) {
        throw new Error(`Bundle not found: missing source key for ${bundleId}`);
      }
      const skillNames = this.getInstalledSkillNames(remoteBundle);

      for (const skillName of skillNames) {
        const targetDir = join(targetBase, skillName);
        if (this.fs.fileExists(targetDir)) {
          this.fs.removeDir(targetDir);
        }
        this.groupsService.removeSkillFromAll(`${sourceKey}/${skillName}`);
        removed++;
      }

      this.sourcesService.removeSource(sourceKey);
      const stopAt = join(SKILLS_MANAGER_DIR, sourceKey.split('/')[0]);
      cleanEmptyParents(targetBase, stopAt);
    } else {
      for (const member of remoteBundle.members) {
        const targetDir = join(SKILLS_MANAGER_DIR, ...member.split('/'));
        if (this.fs.fileExists(targetDir)) {
          this.fs.removeDir(targetDir);
        }

        const sourceParts = member.split('/');
        const categoryDir = join(SKILLS_MANAGER_DIR, sourceParts[0]);
        cleanEmptyParents(join(targetDir, '..'), categoryDir);
        this.sourcesService.removeSource(member);
        this.groupsService.removeSkillFromAll(member);
        removed++;
      }
    }

    this.sourcesService.removeBundle(bundleId);
    return { removed };
  }

  async scanCurrentSourceSkills(bundle: RemoteBundleInfo): Promise<string[]> {
    if (bundle.type !== 'git') return [];
    const listing = await this.cloneAndScan(bundle);
    try {
      return [...listing.skills.keys()].sort();
    } finally {
      listing.cleanup();
    }
  }

  private async cloneAndScan(bundle: RemoteBundleInfo): Promise<BundleListing> {
    const cloned = await this.cloneRepo(bundle.url);
    try {
      const skills = this.scanSkills(cloned.repoPath);
      const skillMap = new Map<string, string>();
      for (const skill of skills) {
        if (!skillMap.has(skill.name)) {
          skillMap.set(skill.name, skill.path);
        }
      }
      return { skills: skillMap, commitSha: cloned.commitSha, cleanup: cloned.cleanup };
    } catch (error) {
      cloned.cleanup();
      throw error;
    }
  }

  computeDiff(currentSkills: string[], bundleMembers: string[]): {
    added: string[];
    existing: string[];
    removed: string[];
  } {
    const currentSet = new Set(currentSkills);
    const memberSet = new Set(bundleMembers);

    const added = currentSkills.filter((name) => !memberSet.has(name)).sort();
    const existing = currentSkills.filter((name) => memberSet.has(name)).sort();
    const removed = bundleMembers.filter((name) => !currentSet.has(name)).sort();

    return { added, existing, removed };
  }

  private applyExisting(
    bundle: RemoteBundleInfo,
    skillName: string,
    listing: BundleListing,
  ): boolean {
    const sourcePath = listing.skills.get(skillName);
    if (!sourcePath) {
      throw new Error(`skill not present in cloned repo`);
    }

    const targetDir = join(this.getGitTargetBase(bundle), skillName);
    const localSkillMd = join(targetDir, 'SKILL.md');
    const sourceSkillMd = join(sourcePath, 'SKILL.md');

    if (!fileExists(sourceSkillMd)) {
      throw new Error(`SKILL.md missing in cloned repo at ${sourcePath}`);
    }

    if (this.fs.fileExists(localSkillMd)) {
      const localContent = this.fs.readFileContent(localSkillMd);
      const sourceContent = readFileContent(sourceSkillMd);
      if (localContent === sourceContent) {
        return false;
      }
    }

    this.fs.removeDir(targetDir);
    copyDir(sourcePath, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));
    this.updateGitSourceTimestamp(bundle);
    return true;
  }

  private applyAdded(
    bundle: RemoteBundleInfo,
    skillName: string,
    primarySourceKey: string | undefined,
    listing: BundleListing,
  ): void {
    const sourcePath = listing.skills.get(skillName);
    if (!sourcePath) {
      throw new Error(`skill not present in cloned repo`);
    }

    const targetDir = join(this.getGitTargetBase(bundle), skillName);
    this.fs.removeDir(targetDir);
    copyDir(sourcePath, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));
    if (primarySourceKey) {
      this.sourcesService.updateTimestamp(primarySourceKey);
    }
  }

  private applyRemoved(
    bundle: RemoteBundleInfo,
    skillName: string,
    primarySourceKey?: string,
  ): void {
    if (bundle.type === 'git') {
      const targetDir = join(this.getGitTargetBase(bundle), skillName);
      this.fs.removeDir(targetDir);
      if (primarySourceKey) {
        this.groupsService.removeSkillFromAll(`${primarySourceKey}/${skillName}`);
      }
      const stopAt = join(SKILLS_MANAGER_DIR, primarySourceKey?.split('/')[0] ?? 'community');
      cleanEmptyParents(this.getGitTargetBase(bundle), stopAt);
    }
  }

  private getInstalledSkillNames(bundle: RemoteBundleInfo): string[] {
    const targetBase = this.getGitTargetBase(bundle);
    if (!this.fs.fileExists(targetBase)) {
      return [];
    }

    return this.fs
      .getDirectoriesInDir(targetBase)
      .filter((entry) => this.fs.fileExists(join(entry.path, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
  }

  private getPrimarySourceKey(bundle: Bundle): string | undefined {
    return bundle.members[0];
  }

  private getGitTargetBase(bundle: RemoteBundleInfo): string {
    const primarySourceKey = this.getPrimarySourceKey(bundle);
    if (primarySourceKey) {
      const parts = primarySourceKey.split('/');
      if (parts[0] === 'official' || parts[0] === 'community') {
        const baseParts = parts.length >= 4 ? parts.slice(0, 3) : parts;
        return join(SKILLS_MANAGER_DIR, ...baseParts);
      }

      if (parts[0] === 'custom') {
        const baseParts = parts.length >= 3 ? parts.slice(0, 2) : parts;
        return join(SKILLS_MANAGER_DIR, ...baseParts);
      }
    }

    const parsed = this.githubService.parseGitHubUrl(bundle.url);
    if (!parsed) {
      throw new Error(`Invalid GitHub bundle URL: ${bundle.url}`);
    }

    const providerKey = findOfficialProvider(parsed.owner);
    if (providerKey) {
      return join(SKILLS_MANAGER_DIR, 'official', providerKey, parsed.repo);
    }

    return join(SKILLS_MANAGER_DIR, 'community', parsed.owner, parsed.repo);
  }

  private updateGitSourceTimestamp(bundle: RemoteBundleInfo): void {
    const sourceKey = this.getPrimarySourceKey(bundle);
    if (sourceKey) {
      this.sourcesService.updateTimestamp(sourceKey);
    }
  }

}

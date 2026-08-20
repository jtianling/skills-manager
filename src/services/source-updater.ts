import { mkdtempSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, findScriptFiles, getDirectoriesInDir, readFileContent, removeDir, warnScriptFiles } from '../utils/fs.js';
import { GitHubService } from './github.js';
import { GroupsService } from './groups.js';
import { RegistryService } from './registry.js';
import { cloneRepoToTemp, collectSkillsFromClone } from './repo-clone.js';
import { SourceInfo, SourcesService } from './sources.js';
import { discoverIndex, type DiscoveryHit } from './wellknown/discovery.js';
import { fetchSkill } from './wellknown/fetch-skill.js';
import type { WellKnownEntry } from './wellknown/index-schema.js';

const KNOWN_SOURCE_TYPES = new Set<SourceInfo['type']>([
  'official',
  'community',
  'custom',
  'registry',
  'well-known',
]);

export interface UpdateResult {
  updated: number;
  upToDate: number;
  failed: number;
  skipped: number;
}

export interface UpdateSourceOptions {
  selectedSkillNames?: Set<string>;
  targetVersion?: string;
}

export type CloneFetcher = (url: string) => Promise<{
  repoPath: string;
  commitSha?: string;
  cleanup(): void;
}>;

export type SkillScanner = (repoPath: string) => Array<{ name: string; path: string }>;

function createEmptyUpdateResult(): UpdateResult {
  return { updated: 0, upToDate: 0, failed: 0, skipped: 0 };
}

function getInstalledSkillDirs(targetBase: string): Array<{ name: string; path: string }> {
  const rootSkillMd = join(targetBase, 'SKILL.md');
  if (fileExists(rootSkillMd)) {
    return [{
      name: targetBase.split('/').pop() || targetBase,
      path: targetBase,
    }];
  }

  return getDirectoriesInDir(targetBase);
}

export class SourceUpdater {
  constructor(
    private readonly sourcesService: SourcesService = new SourcesService(),
    private readonly githubService: GitHubService = new GitHubService(),
    private readonly registryService: RegistryService = new RegistryService(),
    private readonly groupsService: GroupsService = new GroupsService(),
    private readonly cloneRepo: CloneFetcher = cloneRepoToTemp,
    private readonly scanSkills: SkillScanner = (repoPath) =>
      collectSkillsFromClone(repoPath).map((s) => ({ name: s.name, path: s.path })),
  ) {}

  private resolveLocalCopyOriginalPath(key: string, info: SourceInfo): string {
    const parts = key.split('/');
    if (parts[0] !== 'custom' || parts.length !== 3) {
      return info.url;
    }

    const group = this.groupsService.getGroup(parts[1]);
    if (group?.kind !== 'local-batch') {
      return info.url;
    }

    return join(info.url, parts[2]);
  }

  private syncLocalPath(
    key: string,
    originalPath: string,
  ): UpdateResult {
    const result = createEmptyUpdateResult();
    const skillName = key.split('/').pop() || key;

    if (!fileExists(originalPath)) {
      console.log(`  ⚠ ${skillName}: original path not found: ${originalPath}`);
      result.failed++;
      return result;
    }

    const originalSkillMd = join(originalPath, 'SKILL.md');
    if (!fileExists(originalSkillMd)) {
      console.log(`  ⚠ ${skillName}: SKILL.md not found at original path`);
      result.failed++;
      return result;
    }

    const targetDir = join(SKILLS_MANAGER_DIR, key);
    const localSkillMd = join(targetDir, 'SKILL.md');

    if (fileExists(localSkillMd)) {
      const localContent = readFileContent(localSkillMd);
      const originalContent = readFileContent(originalSkillMd);

      if (localContent === originalContent) {
        console.log(`  ✓ ${skillName}: up to date`);
        result.upToDate++;
        return result;
      }
    }

    removeDir(targetDir);
    copyDir(originalPath, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));
    console.log(`  ↑ ${skillName}: updated`);
    result.updated++;
    return result;
  }

  updateLocalPath(key: string, originalPath: string): UpdateResult {
    return this.syncLocalPath(key, originalPath);
  }

  updateLocalCopy(key: string, info: SourceInfo): UpdateResult {
    const result = this.syncLocalPath(
      key,
      this.resolveLocalCopyOriginalPath(key, info),
    );

    if (result.updated > 0) {
      this.sourcesService.updateTimestamp(key);
    }

    return result;
  }

  async updateRegistrySource(
    key: string,
    info: SourceInfo,
    targetVersion?: string,
  ): Promise<UpdateResult> {
    const result = createEmptyUpdateResult();
    const packageName = key.replace(/^registry\//, '');

    try {
      const packument = await this.registryService.getPackument(packageName);
      const latestVersion = packument['dist-tags']?.latest;
      const version = targetVersion ?? latestVersion;

      if (!version) {
        console.log(`  ⚠ ${packageName}: no latest version found`);
        result.failed++;
        return result;
      }

      if (info.version === version) {
        console.log(`  ✓ ${packageName}: up to date (${version})`);
        result.upToDate++;
        return result;
      }

      const versionData = packument.versions[version];
      if (!versionData?.dist?.tarball) {
        console.log(`  ⚠ ${packageName}: no tarball URL for ${version}`);
        result.failed++;
        return result;
      }

      const installDir = join(SKILLS_MANAGER_DIR, key);
      removeDir(installDir);
      await this.registryService.downloadTarball(versionData.dist.tarball, installDir);
      warnScriptFiles(findScriptFiles(installDir));

      this.sourcesService.addSource(key, {
        url: info.url,
        type: 'registry',
        repoName: info.repoName,
        installMethod: info.installMethod,
        version,
        registryUrl: info.registryUrl,
      });

      console.log(`  ↑ ${packageName}: ${info.version} → ${version}`);
      result.updated++;
    } catch (error) {
      console.log(`  ✗ ${packageName}: ${(error as Error).message}`);
      result.failed++;
    }

    return result;
  }

  /**
   * Re-discover the site index and reinstall only the skills whose digest
   * moved. Never touches git: a well-known source has no repository.
   */
  async updateWellKnownSource(
    key: string,
    info: SourceInfo,
    options: UpdateSourceOptions = {},
  ): Promise<UpdateResult> {
    const discovery = await discoverIndex(info.url);

    if (!discovery.ok) {
      console.log(`  ⚠ ${info.repoName}: no well-known index found at ${info.url}`);
      const failed = createEmptyUpdateResult();
      failed.failed++;
      return failed;
    }

    const { result, digests } = await this.syncWellKnownSkills(
      discovery.hit,
      join(SKILLS_MANAGER_DIR, key),
      info.skillDigests ?? {},
      options,
    );

    this.sourcesService.addSource(key, {
      url: info.url,
      type: 'well-known',
      repoName: info.repoName,
      installMethod: info.installMethod,
      skillDigests: digests,
    });

    return result;
  }

  /** Walk the locally installed skills of one site against the fresh index. */
  private async syncWellKnownSkills(
    hit: DiscoveryHit,
    baseDir: string,
    digests: Record<string, string>,
    options: UpdateSourceOptions,
  ): Promise<{ result: UpdateResult; digests: Record<string, string> }> {
    const result = createEmptyUpdateResult();
    const remoteEntries = new Map(hit.entries.map((entry) => [entry.name, entry]));
    const next = { ...digests };

    for (const local of getDirectoriesInDir(baseDir)) {
      if (options.selectedSkillNames && !options.selectedSkillNames.has(local.name)) {
        continue;
      }

      const entry = remoteEntries.get(local.name);
      if (!entry) {
        console.log(`  ⚠ ${local.name}: not found in remote`);
        result.failed++;
        continue;
      }

      try {
        const digest = await this.syncWellKnownSkill(hit, entry, local.path, digests);
        if (digest === null) {
          console.log(`  ✓ ${local.name}: up to date`);
          result.upToDate++;
          continue;
        }
        next[local.name] = digest;
        console.log(`  ↑ ${local.name}: updated`);
        result.updated++;
      } catch (error) {
        console.log(
          `  ✗ ${local.name}: failed to update (${(error as Error).message})`,
        );
        result.failed++;
      }
    }

    return { result, digests: next };
  }

  /** Returns the new digest, or null when the local copy is already current. */
  private async syncWellKnownSkill(
    hit: DiscoveryHit,
    entry: WellKnownEntry,
    targetDir: string,
    digests: Record<string, string>,
  ): Promise<string | null> {
    const known = digests[entry.name];
    if (entry.version === '0.2.0' && known === entry.digest) {
      return null;
    }

    const stagingRoot = mkdtempSync(join(SKILLS_MANAGER_DIR, '.wellknown-update-'));
    const stagingDir = join(stagingRoot, entry.name);

    try {
      const { digest } = await fetchSkill(entry, {
        origin: hit.origin,
        wellKnownPath: hit.wellKnownPath,
        destDir: stagingDir,
      });

      if (digest === known) {
        return null;
      }

      removeDir(targetDir);
      renameSync(stagingDir, targetDir);
      warnScriptFiles(findScriptFiles(targetDir));
      return digest;
    } finally {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }

  async updateSource(
    key: string,
    info: SourceInfo,
    options: UpdateSourceOptions = {},
  ): Promise<UpdateResult> {
    if (info.type === 'registry') {
      return this.updateRegistrySource(key, info, options.targetVersion);
    }

    if (info.type === 'well-known') {
      return this.updateWellKnownSource(key, info, options);
    }

    if (!KNOWN_SOURCE_TYPES.has(info.type)) {
      console.log(
        `  Skipping ${key.split('/').pop() || key}: unknown source type '${info.type}'`,
      );
      return { updated: 0, upToDate: 0, failed: 0, skipped: 1 };
    }

    if (info.installMethod === 'zip') {
      console.log(`  Skipping ${key.split('/').pop() || key}: installed from zip, manual reinstall required`);
      return {
        updated: 0,
        upToDate: 0,
        failed: 0,
        skipped: 1,
      };
    }

    if (info.installMethod === 'local-copy') {
      return this.updateLocalCopy(key, info);
    }

    const parsed = this.githubService.parseGitHubUrl(info.url);
    if (!parsed) {
      console.log(`  ⚠ Cannot parse URL: ${info.url}`);
      return createEmptyUpdateResult();
    }

    const targetBase = join(SKILLS_MANAGER_DIR, key);
    const localSkills = getInstalledSkillDirs(targetBase);

    if (localSkills.length === 0) {
      console.log('  No skills installed locally');
      this.sourcesService.updateTimestamp(key);
      return createEmptyUpdateResult();
    }

    const cloned = await this.cloneRepo(info.url);
    try {
      const scanned = this.scanSkills(cloned.repoPath);
      const skillMap = new Map<string, string>();
      for (const skill of scanned) {
        if (!skillMap.has(skill.name)) {
          skillMap.set(skill.name, skill.path);
        }
      }

      const result = createEmptyUpdateResult();

      for (const localSkill of localSkills) {
        const skillName = localSkill.name;
        if (skillName === 'commands') {
          continue;
        }
        if (options.selectedSkillNames && !options.selectedSkillNames.has(skillName)) {
          continue;
        }

        const targetDir = localSkill.path;
        const localSkillMd = join(targetDir, 'SKILL.md');
        if (!fileExists(localSkillMd)) {
          continue;
        }

        try {
          const remoteSkillPath = skillMap.get(skillName);
          if (!remoteSkillPath) {
            console.log(`  ⚠ ${skillName}: not found in remote`);
            result.failed++;
            continue;
          }

          const remoteSkillMd = join(remoteSkillPath, 'SKILL.md');
          if (!fileExists(remoteSkillMd)) {
            console.log(`  ⚠ ${skillName}: not found in remote`);
            result.failed++;
            continue;
          }

          const localContent = readFileContent(localSkillMd);
          const remoteContent = readFileContent(remoteSkillMd);

          if (remoteContent === localContent) {
            console.log(`  ✓ ${skillName}: up to date`);
            result.upToDate++;
            continue;
          }

          removeDir(targetDir);
          copyDir(remoteSkillPath, targetDir);
          warnScriptFiles(findScriptFiles(targetDir));
          console.log(`  ↑ ${skillName}: updated`);
          result.updated++;
        } catch (error) {
          console.log(`  ✗ ${skillName}: failed to update (${(error as Error).message})`);
          result.failed++;
        }
      }

      if (cloned.commitSha) {
        this.sourcesService.updateVersion(key, cloned.commitSha);
      } else {
        this.sourcesService.updateTimestamp(key);
      }
      return result;
    } finally {
      cloned.cleanup();
    }
  }
}

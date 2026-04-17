import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, findScriptFiles, getDirectoriesInDir, readFileContent, removeDir, warnScriptFiles } from '../utils/fs.js';
import { GitHubService } from './github.js';
import { GroupsService } from './groups.js';
import { RegistryService } from './registry.js';
import { SourceInfo, SourcesService } from './sources.js';

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

  async updateSource(
    key: string,
    info: SourceInfo,
    options: UpdateSourceOptions = {},
  ): Promise<UpdateResult> {
    if (info.type === 'registry') {
      return this.updateRegistrySource(key, info, options.targetVersion);
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

    const { owner, repo } = parsed;
    const targetBase = join(SKILLS_MANAGER_DIR, key);
    const defaultBranch = await this.githubService.getDefaultBranch(owner, repo);
    const localSkills = getInstalledSkillDirs(targetBase);
    const result = createEmptyUpdateResult();

    if (localSkills.length > 0) {
      const { skillsPath: skillsBasePath } = await this.githubService.listSkillsWithFallbackPaths(
        owner,
        repo,
      );

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

        const remotePath = skillsBasePath === '.' ? skillName : `${skillsBasePath}/${skillName}`;

        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${remotePath}/SKILL.md`,
          );

          if (!response.ok) {
            const rootContent = await this.githubService.fetchRootFile(owner, repo, defaultBranch, 'SKILL.md');
            if (rootContent) {
              const localContent = readFileContent(localSkillMd);
              if (rootContent === localContent) {
                console.log(`  ✓ ${skillName}: up to date`);
                result.upToDate++;
              } else {
                removeDir(targetDir);
                await this.githubService.downloadRepoRoot(owner, repo, targetDir);
                warnScriptFiles(findScriptFiles(targetDir));
                console.log(`  ↑ ${skillName}: updated`);
                result.updated++;
              }
            } else {
              console.log(`  ⚠ ${skillName}: not found in remote`);
              result.failed++;
            }
            continue;
          }

          const remoteContent = await response.text();
          const localContent = readFileContent(localSkillMd);

          if (remoteContent === localContent) {
            console.log(`  ✓ ${skillName}: up to date`);
            result.upToDate++;
          } else {
            removeDir(targetDir);
            await this.githubService.downloadSkill(owner, repo, remotePath, targetDir);
            warnScriptFiles(findScriptFiles(targetDir));
            console.log(`  ↑ ${skillName}: updated`);
            result.updated++;
          }
        } catch {
          console.log(`  ✗ ${skillName}: failed to update`);
          result.failed++;
        }
      }
    }

    if (localSkills.length === 0) {
      console.log('  No skills installed locally');
    }

    this.sourcesService.updateTimestamp(key);
    return result;
  }
}

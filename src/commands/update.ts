import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { BundleManager, BundleSyncResult } from '../services/bundle-manager.js';
import { GitHubService } from '../services/github.js';
import { RegistryService } from '../services/registry.js';
import { SourcesService, SourceInfo } from '../services/sources.js';
import { SkillsService } from '../services/skills.js';
import { ResolvedTarget, SourceResolver } from '../services/source-resolver.js';
import { copyDir, fileExists, findScriptFiles, removeDir, readFileContent, getDirectoriesInDir, warnScriptFiles } from '../utils/fs.js';
import { detectSourceType } from '../utils/source-detection.js';
import { ensureSetup } from './setup.js';

const sourcesService = new SourcesService();
const githubService = new GitHubService();
const registryService = new RegistryService();
const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
const sourceResolver = new SourceResolver(
  sourcesService,
  skillsService,
  githubService
);
const bundleManager = new BundleManager(sourcesService, githubService);

interface UpdateResult {
  updated: number;
  upToDate: number;
  failed: number;
  skipped: number;
}

interface UpdateOptions {
  sync?: boolean;
  verbose?: boolean;
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

function updateLocalCopy(key: string, info: SourceInfo): UpdateResult {
  const result: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };
  const skillName = key.split('/').pop() || key;
  const originalPath = info.url;

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

  const sourcesService = new SourcesService();
  sourcesService.updateTimestamp(key);

  return result;
}

async function updateRegistrySource(
  key: string,
  info: SourceInfo,
  targetVersion?: string
): Promise<UpdateResult> {
  const result: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };

  const packageName = key.replace(/^registry\//, '');

  try {
    const packument = await registryService.getPackument(packageName);
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

    await registryService.downloadTarball(versionData.dist.tarball, installDir);
    warnScriptFiles(findScriptFiles(installDir));

    // Update source info with new version
    sourcesService.addSource(key, {
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

async function updateSource(
  key: string,
  info: SourceInfo,
  selectedSkillNames?: Set<string>,
  targetVersion?: string
): Promise<UpdateResult> {
  const result: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };

  if (info.type === 'registry') {
    return updateRegistrySource(key, info, targetVersion);
  }

  if (info.installMethod === 'zip') {
    console.log(`  Skipping ${key.split('/').pop() || key}: installed from zip, manual reinstall required`);
    result.skipped++;
    return result;
  }

  if (info.installMethod === 'local-copy') {
    return updateLocalCopy(key, info);
  }

  const parsed = githubService.parseGitHubUrl(info.url);
  if (!parsed) {
    console.log(`  ⚠ Cannot parse URL: ${info.url}`);
    return result;
  }

  const { owner, repo } = parsed;

  // Derive target directory from the source key (e.g., "official/anthropic" or "community/obra/superpowers")
  const targetBase = join(SKILLS_MANAGER_DIR, key);

  // Get the default branch
  const defaultBranch = await githubService.getDefaultBranch(owner, repo);

  const localSkills = getInstalledSkillDirs(targetBase);

  if (localSkills.length > 0) {
    const { skillsPath: skillsBasePath } = await githubService.listSkillsWithFallbackPaths(
      owner,
      repo,
    );

    for (const localSkill of localSkills) {
      const skillName = localSkill.name;
      if (skillName === 'commands') continue;
      if (selectedSkillNames && !selectedSkillNames.has(skillName)) continue;

      const targetDir = localSkill.path;
      const localSkillMd = join(targetDir, 'SKILL.md');

      if (!fileExists(localSkillMd)) {
        continue;
      }

      const remotePath = skillsBasePath === '.' ? skillName : `${skillsBasePath}/${skillName}`;

      try {
        // Fetch remote SKILL.md via standard path
        const response = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${remotePath}/SKILL.md`
        );

        if (!response.ok) {
          // Standard path failed, check if this is a root-skill repo
          const rootContent = await githubService.fetchRootFile(owner, repo, defaultBranch, 'SKILL.md');
          if (rootContent) {
            const localContent = readFileContent(localSkillMd);
            if (rootContent === localContent) {
              console.log(`  ✓ ${skillName}: up to date`);
              result.upToDate++;
            } else {
              removeDir(targetDir);
              await githubService.downloadRepoRoot(owner, repo, targetDir);
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

        // Compare content
        if (remoteContent === localContent) {
          console.log(`  ✓ ${skillName}: up to date`);
          result.upToDate++;
        } else {
          // Content changed, update
          removeDir(targetDir);
          await githubService.downloadSkill(owner, repo, remotePath, targetDir);
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
    console.log(`  No skills installed locally`);
  }

  // Update timestamp
  sourcesService.updateTimestamp(key);

  return result;
}

async function updateSingleSkill(
  key: string,
  info: SourceInfo,
  target: ResolvedTarget
): Promise<UpdateResult> {
  const selectedNames = new Set((target.skills ?? []).map((skill) => skill.name));
  return updateSource(key, info, selectedNames, target.requestedVersion);
}

function printUpdateNotFound(source: string, target: ResolvedTarget): void {
  if (detectSourceType(source) === 'local-path' && target.reason) {
    console.log(target.reason);
    return;
  }

  console.log(`Source '${source}' not found.`);
  if (target.reason) {
    console.log(target.reason);
  }

  const allSources = sourcesService.getAllSources();
  console.log('\nInstalled sources:');
  for (const key of Object.keys(allSources)) {
    console.log(`  ${key}`);
  }
}

export async function executeUpdate(source?: string): Promise<void> {
  return executeUpdateWithOptions(source);
}

function printBundleUpdateSummary(result: BundleSyncResult): void {
  console.log(
    `\nDone! ${result.updated} updated, ${result.added} added, ` +
      `${result.removedKept} removed (kept), ${result.removedHard} removed, ` +
      `${result.upToDate} up to date, ${result.failed} failed`
  );
}

export async function executeUpdateWithOptions(
  source?: string,
  options: UpdateOptions = {},
): Promise<void> {
  await ensureSetup();

  const allSources = sourcesService.getAllSources();

  if (Object.keys(allSources).length === 0) {
    console.log('No installed sources found.');
    console.log('\nRun: skillsmgr install anthropics/skills');
    return;
  }

  // If specific source provided, only update that one
  if (source) {
    const target = await sourceResolver.resolve(source);

    if (target.kind === 'not-found') {
      printUpdateNotFound(source, target);
      return;
    }

    if (target.kind === 'bundle') {
      const bundleId = target.bundleId;
      if (!bundleId) {
        throw new Error(`Missing bundle id for ${source}`);
      }

      console.log(`Updating ${bundleId}...\n`);
      const result = await bundleManager.sync(bundleId, {
        sync: options.sync,
        verbose: options.verbose,
      });
      if (result.failed > 0) {
        process.exitCode = 1;
      }
      printBundleUpdateSummary(result);
      return;
    }

    const sourceKeys = target.kind === 'skill'
      ? [...new Set((target.skills ?? []).map((skill) => skill.source))]
      : target.sourceKeys;
    const totals: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };

    for (const key of sourceKeys) {
      const info = allSources[key];
      if (!info) {
        totals.failed++;
        continue;
      }

      console.log(`Updating ${key}...\n`);
      const result = target.kind === 'skill'
        ? await updateSingleSkill(key, info, target)
        : await updateSource(key, info, undefined, target.requestedVersion);
      totals.updated += result.updated;
      totals.upToDate += result.upToDate;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    console.log(
      `\nDone! ${totals.updated} updated, ${totals.upToDate} up to date, ` +
        `${totals.failed} failed, ${totals.skipped} skipped`
    );
    return;
  }

  // Update all sources
  console.log('Updating all installed sources...\n');

  let totalUpdated = 0;
  let totalUpToDate = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [key, info] of Object.entries(allSources)) {
    console.log(`${key}:`);
    const result = await updateSource(key, info);
    totalUpdated += result.updated;
    totalUpToDate += result.upToDate;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
    console.log();
  }

  console.log(`Done! ${totalUpdated} updated, ${totalUpToDate} up to date, ${totalFailed} failed, ${totalSkipped} skipped`);
}

export const updateCommand = new Command('update')
  .description('Update installed skills to latest version')
  .argument('[source]', 'Specific source to update (e.g., "anthropic")')
  .option('--sync', 'Remove bundle members that no longer exist in the source')
  .option('-v, --verbose', 'Show every bundle member status during sync')
  .action(async (source: string | undefined, options: UpdateOptions) => {
    await executeUpdateWithOptions(source, options);
  });

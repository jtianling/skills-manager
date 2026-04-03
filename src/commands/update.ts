import { Command } from 'commander';
import { basename, join, resolve } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitHubService } from '../services/github.js';
import { RegistryService } from '../services/registry.js';
import { SourcesService, SourceInfo } from '../services/sources.js';
import { copyDir, fileExists, findScriptFiles, removeDir, readFileContent, getDirectoriesInDir, warnScriptFiles } from '../utils/fs.js';
import { detectSourceType } from '../utils/source-detection.js';
import { findInstalledCustomSkill } from './install-utils.js';
import { ensureSetup } from './setup.js';

const sourcesService = new SourcesService();
const githubService = new GitHubService();

interface UpdateResult {
  updated: number;
  upToDate: number;
  failed: number;
  skipped: number;
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

const registryService = new RegistryService();

async function updateRegistrySource(key: string, info: SourceInfo): Promise<UpdateResult> {
  const result: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };

  // Extract package name from key (e.g., "registry/code-review" -> "code-review")
  const packageName = key.replace(/^registry\//, '');

  try {
    const packument = await registryService.getPackument(packageName);
    const latestVersion = packument['dist-tags']?.latest;

    if (!latestVersion) {
      console.log(`  ⚠ ${packageName}: no latest version found`);
      result.failed++;
      return result;
    }

    if (info.version === latestVersion) {
      console.log(`  ✓ ${packageName}: up to date (${latestVersion})`);
      result.upToDate++;
      return result;
    }

    const versionData = packument.versions[latestVersion];
    if (!versionData?.dist?.tarball) {
      console.log(`  ⚠ ${packageName}: no tarball URL for ${latestVersion}`);
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
      version: latestVersion,
      registryUrl: info.registryUrl,
    });

    console.log(`  ↑ ${packageName}: ${info.version} → ${latestVersion}`);
    result.updated++;
  } catch (error) {
    console.log(`  ✗ ${packageName}: ${(error as Error).message}`);
    result.failed++;
  }

  return result;
}

async function updateSource(key: string, info: SourceInfo): Promise<UpdateResult> {
  const result: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };

  if (info.type === 'registry') {
    return updateRegistrySource(key, info);
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
    // Try common skills directory locations to find remote path pattern
    let skillsBasePath = 'skills';
    const skillsPaths = ['skills', '.', 'src/skills'];

    for (const skillsPath of skillsPaths) {
      try {
        const testList = await githubService.listSkills(owner, repo, skillsPath);
        if (testList.length > 0) {
          skillsBasePath = skillsPath;
          break;
        }
      } catch {
        continue;
      }
    }

    // Update only locally installed skills
    for (const localSkill of localSkills) {
      const skillName = localSkill.name;
      // Skip residual commands directory
      if (skillName === 'commands') continue;

      const targetDir = localSkill.path;
      const localSkillMd = join(targetDir, 'SKILL.md');

      // Check if local skill has SKILL.md
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

export async function executeUpdate(source?: string): Promise<void> {
  await ensureSetup();

  const allSources = sourcesService.getAllSources();

  if (Object.keys(allSources).length === 0) {
    console.log('No installed sources found.');
    console.log('\nRun: skillsmgr install anthropics/skills');
    return;
  }

  // If specific source provided, only update that one
  if (source) {
    const sourceType = detectSourceType(source);

    if (sourceType === 'local-path') {
      const sourcePath = resolve(process.cwd(), source);

      if (!fileExists(sourcePath)) {
        console.log(`Source path not found: ${sourcePath}`);
        return;
      }

      if (!fileExists(join(sourcePath, 'SKILL.md'))) {
        console.log(`SKILL.md not found at: ${sourcePath}`);
        return;
      }

      const skillName = basename(sourcePath);
      const installed = findInstalledCustomSkill(skillName);

      if (!installed) {
        console.log(`No installed skill found: ${skillName}`);
        return;
      }

      console.log(`Updating ${installed.key} from ${sourcePath}...\n`);
      const result = updateLocalCopy(installed.key, { ...allSources[installed.key], url: sourcePath } as SourceInfo);

      if (result.updated > 0 || result.upToDate > 0) {
        const existing = allSources[installed.key];
        if (existing) {
          sourcesService.addSource(installed.key, {
            url: sourcePath,
            type: existing.type,
            repoName: existing.repoName,
            installMethod: existing.installMethod,
          });
        } else {
          sourcesService.addSource(installed.key, {
            url: sourcePath,
            type: 'custom',
            repoName: skillName,
            installMethod: 'local-copy',
          });
        }
      }

      console.log(`\nDone! ${result.updated} updated, ${result.upToDate} up to date, ${result.failed} failed, ${result.skipped} skipped`);
      return;
    }

    // Other types: match by key or repoName
    const matchingKey = Object.keys(allSources).find(
      (k) => k === source || k.endsWith(`/${source}`) || allSources[k].repoName === source
    );

    if (!matchingKey) {
      console.log(`Source '${source}' not found.`);
      console.log('\nInstalled sources:');
      for (const key of Object.keys(allSources)) {
        console.log(`  ${key}`);
      }
      return;
    }

    console.log(`Updating ${matchingKey}...\n`);
    const result = await updateSource(matchingKey, allSources[matchingKey]);
    console.log(`\nDone! ${result.updated} updated, ${result.upToDate} up to date, ${result.failed} failed, ${result.skipped} skipped`);
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
  .action(async (source?: string) => {
    await executeUpdate(source);
  });

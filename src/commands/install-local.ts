import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { SourcesService } from '../services/sources.js';
import type { InstallOptions } from '../types.js';
import { copyDir, fileExists, findScriptFiles, removeDir, warnScriptFiles } from '../utils/fs.js';
import { makeBundleId, normalizeLocalPath } from '../utils/url-normalize.js';
import {
  createInstallResult,
  findInstalledCustomSkill,
  getCustomSkillDir,
  getCustomSkillKey,
  getLocalOverwriteMessage,
  installSingleSkillToLocalTarget,
  prepareTargetDir,
  scanSkillDirectories,
  selectSkills,
} from './install-utils.js';
import type { InstallResult } from './install-utils.js';

const sourcesService = new SourcesService();

function formatReinstallConflictMessage(
  kind: 'Skill' | 'A local bundle',
  name: string,
  existingPath: string,
  newPath: string,
): string {
  return (
    `${kind} '${name}' is already installed from ${existingPath}. ` +
    `To move it to ${newPath}, run: skillsmgr update ${newPath}`
  );
}

function formatBatchConflictList(
  dirName: string,
  candidates: Array<{ id: string; url: string }>,
): string {
  const lines = candidates
    .map((candidate) => `  - ${candidate.id}: ${candidate.url}`)
    .join('\n');
  return (
    `Multiple local bundles named '${dirName}' are already installed:\n${lines}\n` +
    'Clean up the duplicate bundle entries and try again.'
  );
}

function isBareLocalSource(input: string): boolean {
  return !input.includes('/') && !input.startsWith('~');
}

function isTopLevelCustomSkillKey(sourceKey: string): boolean {
  return sourceKey.split('/').length === 2;
}

export function resolveLocalSourcePath(input: string): string {
  return normalizeLocalPath(input);
}

export async function installFromLocalDir(source: string, options: InstallOptions): Promise<InstallResult> {
  const skillDir = resolveLocalSourcePath(source);
  if (!fileExists(skillDir)) {
    if (isBareLocalSource(source)) {
      throw new Error(`Directory ./${source} not found. For remote install, use owner/repo format.`);
    }
    throw new Error(`Directory not found: ${skillDir}`);
  }

  const skillMd = join(skillDir, 'SKILL.md');
  if (!fileExists(skillMd)) {
    return installFromLocalDirBatch(skillDir, options);
  }

  const skillName = basename(skillDir);
  const existing = findInstalledCustomSkill(skillName);
  let targetDir: string;
  let sourceKey: string;

  if (existing && isTopLevelCustomSkillKey(existing.key)) {
    targetDir = existing.path;
    sourceKey = existing.key;
    const existingSource = sourcesService.getSource(sourceKey);
    if (
      existingSource?.installMethod === 'local-copy' &&
      normalizeLocalPath(existingSource.url) !== skillDir
    ) {
      throw new Error(
        formatReinstallConflictMessage(
          'Skill',
          skillName,
          normalizeLocalPath(existingSource.url),
          skillDir,
        ),
      );
    }
  } else {
    targetDir = getCustomSkillDir(skillName);
    sourceKey = getCustomSkillKey(skillName);
  }

  const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skillName), options.force);
  if (!ready) {
    return createInstallResult([], []);
  }

  installSingleSkillToLocalTarget(skillDir, targetDir);

  sourcesService.addSource(sourceKey, {
    url: skillDir,
    type: 'custom',
    repoName: skillName,
    installMethod: 'local-copy',
  });

  console.log(`✓ Installed skill '${skillName}' to ${targetDir}`);
  return createInstallResult([targetDir], [sourceKey]);
}

async function installFromLocalDirBatch(skillDir: string, options: InstallOptions): Promise<InstallResult> {
  const dirName = basename(skillDir);
  const bundleCandidates = sourcesService
    .findLocalBatchBundlesByBasename(dirName)
    .map(({ id, bundle }) => ({
      id,
      url: normalizeLocalPath(bundle.url),
    }));
  if (bundleCandidates.length > 1) {
    throw new Error(formatBatchConflictList(dirName, bundleCandidates));
  }
  if (bundleCandidates.length === 1 && bundleCandidates[0].url !== skillDir) {
    throw new Error(
      formatReinstallConflictMessage(
        'A local bundle',
        dirName,
        bundleCandidates[0].url,
        skillDir,
      ),
    );
  }

  const scannedSkills = scanSkillDirectories(skillDir, 1);

  if (scannedSkills.length === 0) {
    throw new Error(`No skills found in ${skillDir}`);
  }

  const installedNames = new Set<string>();
  for (const skill of scannedSkills) {
    if (fileExists(getCustomSkillDir(skill.name, dirName))) {
      installedNames.add(skill.name);
    }
  }

  const { skills: selectedSkills, isAll } = await selectSkills(
    scannedSkills,
    options,
    installedNames,
  );
  if (selectedSkills.length === 0) {
    return createInstallResult([], []);
  }

  const installedPaths: string[] = [];
  const sourceKeys: string[] = [];
  const allScriptFiles: string[] = [];

  for (const skill of selectedSkills) {
    const targetDir = getCustomSkillDir(skill.name, dirName);
    const sourceKey = getCustomSkillKey(skill.name, dirName);

    const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skill.name), options.force);
    if (!ready) {
      break;
    }

    installSingleSkillToLocalTarget(skill.path, targetDir);
    installedPaths.push(targetDir);
    allScriptFiles.push(...findScriptFiles(targetDir));

    sourcesService.addSource(sourceKey, {
      url: skillDir,
      type: 'custom',
      repoName: skill.name,
      installMethod: 'local-copy',
    });
    sourceKeys.push(sourceKey);
  }

  warnScriptFiles(allScriptFiles);

  if (installedPaths.length > 0) {
    console.log(`✓ Installed ${installedPaths.length} skill${installedPaths.length === 1 ? '' : 's'} from ${dirName}`);
  }

  return createInstallResult(installedPaths, sourceKeys, {
    batchGroupName: dirName,
    bundleInfo: {
      id: makeBundleId('local-batch', skillDir),
      info: {
        type: 'local-batch',
        url: skillDir,
        selectionMode: isAll ? 'all' : 'subset',
        members: sourceKeys,
      },
    },
  });
}

export async function installFromZip(source: string, options: InstallOptions, originalSource = source): Promise<InstallResult> {
  const zipPath = resolveLocalSourcePath(source);
  if (!fileExists(zipPath)) {
    throw new Error(`Zip file not found: ${zipPath}`);
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-zip-'));
  const extractDir = join(tempDir, 'extract');
  mkdirSync(extractDir, { recursive: true });

  try {
    execFileSync('unzip', ['-qq', zipPath, '-d', extractDir]);

    const scannedSkills = scanSkillDirectories(extractDir);
    if (scannedSkills.length === 0) {
      throw new Error('No skills found in zip file');
    }

    const { skills: selectedSkills, isAll } = await selectSkills(scannedSkills, options);
    if (selectedSkills.length === 0) {
      return createInstallResult([], []);
    }

    const installedPaths: string[] = [];
    const sourceKeys: string[] = [];
    const allScriptFiles: string[] = [];

    for (const skill of selectedSkills) {
      const targetDir = getCustomSkillDir(skill.name);
      const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skill.name), options.force);
      if (!ready) {
        break;
      }

      copyDir(skill.path, targetDir);
      installedPaths.push(targetDir);
      allScriptFiles.push(...findScriptFiles(targetDir));

      const sourceKey = getCustomSkillKey(skill.name);
      sourcesService.addSource(sourceKey, {
        url: originalSource,
        type: 'custom',
        repoName: skill.name,
        installMethod: 'zip',
      });
      sourceKeys.push(sourceKey);
    }

    warnScriptFiles(allScriptFiles);

    if (installedPaths.length > 0) {
      console.log(`✓ Installed ${installedPaths.length} skill${installedPaths.length === 1 ? '' : 's'} from zip`);
    }

    const bundleUrl = originalSource.startsWith('http://') || originalSource.startsWith('https://')
      ? originalSource
      : zipPath;

    return createInstallResult(installedPaths, sourceKeys, {
      bundleInfo: {
        id: makeBundleId('zip', bundleUrl),
        info: {
          type: 'zip',
          url: bundleUrl,
          selectionMode: isAll ? 'all' : 'subset',
          members: sourceKeys,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to install from zip file');
  } finally {
    removeDir(tempDir);
  }
}

export async function installFromRemoteZip(url: string, options: InstallOptions): Promise<InstallResult> {
  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-remote-zip-'));
  const zipPath = join(tempDir, 'download.zip');

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download zip file: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(zipPath, buffer);
    return installFromZip(zipPath, options, url);
  } finally {
    removeDir(tempDir);
  }
}

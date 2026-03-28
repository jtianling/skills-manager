import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { homedir, tmpdir } from 'os';
import { SourcesService } from '../services/sources.js';
import type { InstallOptions } from '../types.js';
import { copyDir, fileExists, findScriptFiles, removeDir, warnScriptFiles } from '../utils/fs.js';
import {
  createInstallResult,
  findInstalledCustomSkill,
  getCustomSkillDir,
  getCustomSkillKey,
  getLocalOverwriteMessage,
  prepareTargetDir,
  scanSkillDirectories,
  selectSkills,
} from './install-utils.js';
import type { InstallResult } from './install-utils.js';

const sourcesService = new SourcesService();

export function expandHomePath(input: string): string {
  if (input === '~') {
    return homedir();
  }

  if (input.startsWith('~/')) {
    return join(homedir(), input.slice(2));
  }

  return input;
}

function isBareLocalSource(input: string): boolean {
  return !input.includes('/') && !input.startsWith('~');
}

export function resolveLocalSourcePath(input: string): string {
  const normalized = expandHomePath(input);
  if (normalized.startsWith('/')) {
    return normalized;
  }

  return resolve(process.cwd(), normalized);
}

export async function installFromLocalDir(source: string, options: InstallOptions): Promise<InstallResult> {
  const skillDir = resolveLocalSourcePath(source);
  if (!fileExists(skillDir)) {
    if (isBareLocalSource(source)) {
      throw new Error(`Directory ./${source} not found. For remote install, use owner/repo format.`);
    }
    throw new Error(`Directory not found: ${skillDir}`);
  }

  const skillName = basename(skillDir);
  const skillMd = join(skillDir, 'SKILL.md');
  if (!fileExists(skillMd)) {
    throw new Error(`Skill not found. Expected SKILL.md in ${skillDir}`);
  }

  const existing = findInstalledCustomSkill(skillName);
  let targetDir: string;
  let sourceKey: string;

  if (existing) {
    targetDir = existing.path;
    sourceKey = existing.key;
  } else {
    targetDir = getCustomSkillDir(skillName);
    sourceKey = getCustomSkillKey(skillName);
  }

  const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skillName), options.force);
  if (!ready) {
    return createInstallResult([], []);
  }

  copyDir(skillDir, targetDir);
  warnScriptFiles(findScriptFiles(targetDir));

  sourcesService.addSource(sourceKey, {
    url: skillDir,
    type: 'custom',
    repoName: skillName,
    installMethod: 'local-copy',
  });

  console.log(`✓ Installed skill '${skillName}' to ${targetDir}`);
  return createInstallResult([targetDir], [sourceKey]);
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

    const selectedSkills = await selectSkills(scannedSkills, options);
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

    return createInstallResult(installedPaths, sourceKeys);
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

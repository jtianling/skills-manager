import { basename, join } from 'path';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import type { InstallOptions } from '../types.js';
import { SourcesService } from '../services/sources.js';
import {
  copyDir,
  fileExists,
  findScriptFiles,
  getDirectoriesInDir,
  readFileContent,
  removeDir,
  warnScriptFiles,
} from '../utils/fs.js';
import { promptConfirm, promptSkillsToInstall } from '../utils/prompts.js';
import type { BundleInfo } from '../types.js';

export interface InstalledCustomSkill {
  key: string;
  path: string;
}

export function findInstalledCustomSkills(skillName: string): InstalledCustomSkill[] {
  const customDir = join(SKILLS_MANAGER_DIR, 'custom');
  if (!fileExists(customDir)) {
    return [];
  }

  const results: InstalledCustomSkill[] = [];

  const directPath = join(customDir, skillName);
  if (fileExists(join(directPath, 'SKILL.md'))) {
    results.push({ key: `custom/${skillName}`, path: directPath });
  }

  for (const subdir of getDirectoriesInDir(customDir)) {
    if (fileExists(join(subdir.path, 'SKILL.md'))) {
      continue;
    }
    const nestedPath = join(subdir.path, skillName);
    if (fileExists(join(nestedPath, 'SKILL.md'))) {
      results.push({ key: `custom/${subdir.name}/${skillName}`, path: nestedPath });
    }
  }

  return results;
}

export function findInstalledCustomSkill(skillName: string): InstalledCustomSkill | null {
  const results = findInstalledCustomSkills(skillName);
  return results.length > 0 ? results[0] : null;
}

export function findCustomSkillByKey(sourceKey: string): InstalledCustomSkill | null {
  const parts = sourceKey.split('/');
  if (parts[0] !== 'custom') {
    return null;
  }

  const skillPath = join(SKILLS_MANAGER_DIR, ...parts);
  if (fileExists(join(skillPath, 'SKILL.md'))) {
    return { key: sourceKey, path: skillPath };
  }
  return null;
}

const sourcesService = new SourcesService();

export interface InstallableSkill {
  name: string;
  description: string;
  path: string;
}

export interface InstallResult {
  basePath: string;
  sourceKey: string;
  installedPaths?: string[];
  sourceKeys?: string[];
  batchGroupName?: string;
  bundleInfo?: {
    id: string;
    info: Omit<BundleInfo, 'installedAt' | 'updatedAt'>;
  };
}

export interface SelectedSkillsResult {
  skills: InstallableSkill[];
  isAll: boolean;
}

export function parseMdFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2].trim();
    }
  }

  return result;
}

export function parseMdDescription(content: string): string {
  return parseMdFrontmatter(content).description ?? '';
}

export function getCustomSkillDir(skillName: string, subdirectory?: string): string {
  if (subdirectory) {
    return join(SKILLS_MANAGER_DIR, 'custom', subdirectory, skillName);
  }
  return join(SKILLS_MANAGER_DIR, 'custom', skillName);
}

export function getCustomSkillKey(skillName: string, subdirectory?: string): string {
  if (subdirectory) {
    return `custom/${subdirectory}/${skillName}`;
  }
  return `custom/${skillName}`;
}

function getGitSourceInfo(owner: string, repo: string, options: InstallOptions): {
  type: 'official' | 'community' | 'custom';
  sourceKey: string;
} {
  const providerKey = findOfficialProvider(owner);

  if (providerKey) {
    return {
      type: 'official',
      sourceKey: `official/${providerKey}/${repo}`,
    };
  }

  if (options.custom) {
    return {
      type: 'custom',
      sourceKey: `custom/${repo}`,
    };
  }

  return {
    type: 'community',
    sourceKey: `community/${owner}/${repo}`,
  };
}

export function saveRepoGitSource(owner: string, repo: string, options: InstallOptions, url?: string): string {
  const { type, sourceKey } = getGitSourceInfo(owner, repo, options);
  sourcesService.addSource(sourceKey, {
    url: url ?? `https://github.com/${owner}/${repo}`,
    type,
    repoName: repo,
    installMethod: 'git',
  });
  return sourceKey;
}

export function getRemoteSkillTargetDir(owner: string, repo: string, skillName: string, options: InstallOptions): string {
  const providerKey = findOfficialProvider(owner);
  if (providerKey) {
    return join(SKILLS_MANAGER_DIR, 'official', providerKey, repo, skillName);
  }

  if (options.custom) {
    return join(SKILLS_MANAGER_DIR, 'custom', repo, skillName);
  }

  return join(SKILLS_MANAGER_DIR, 'community', owner, repo, skillName);
}

export function scanSkillDirectories(dir: string, maxDepth = 4): InstallableSkill[] {
  if (!fileExists(dir) || maxDepth < 0) {
    return [];
  }

  const skillMd = join(dir, 'SKILL.md');
  if (fileExists(skillMd)) {
    const content = readFileContent(skillMd);
    const frontmatter = parseMdFrontmatter(content);
    return [{
      name: frontmatter.name || basename(dir),
      description: frontmatter.description ?? '',
      path: dir,
    }];
  }

  if (maxDepth === 0) {
    return [];
  }

  const skills: InstallableSkill[] = [];
  for (const subdir of getDirectoriesInDir(dir)) {
    skills.push(...scanSkillDirectories(subdir.path, maxDepth - 1));
  }

  return skills;
}

export function getLocalOverwriteMessage(skillName: string): string {
  return `Skill '${skillName}' already exists. Overwrite?`;
}

export async function prepareTargetDir(targetDir: string, overwriteMessage: string, force?: boolean): Promise<boolean> {
  if (!fileExists(targetDir)) {
    return true;
  }

  if (force) {
    removeDir(targetDir);
    return true;
  }

  const confirmed = await promptConfirm(overwriteMessage);
  if (!confirmed) {
    console.log('Cancelled.');
    return false;
  }

  removeDir(targetDir);
  return true;
}

export function installSingleSkillToLocalTarget(
  sourcePath: string,
  targetDir: string,
): void {
  copyDir(sourcePath, targetDir);
  warnScriptFiles(findScriptFiles(targetDir));
}

export async function selectSkills(
  skills: InstallableSkill[],
  options: InstallOptions,
  installedNames?: Set<string>,
): Promise<SelectedSkillsResult> {
  if (options.skill && options.skill.length > 0) {
    for (const name of options.skill) {
      if (!skills.some((s) => s.name === name)) {
        console.log(`Skill '${name}' not found.`);
        process.exit(1);
      }
    }
    return {
      skills: skills.filter((s) => options.skill!.includes(s.name)),
      isAll: false,
    };
  }

  if (options.all || skills.length <= 1) {
    return { skills, isAll: true };
  }

  if (installedNames && skills.every((s) => installedNames.has(s.name))) {
    console.log(`All ${skills.length} skills already installed.`);
    return { skills: [], isAll: false };
  }

  const selected = await promptSkillsToInstall(skills, installedNames);
  if (selected.names.length === 0) {
    console.log(installedNames?.size ? 'No new skills to install' : 'No skills selected');
    return { skills: [], isAll: false };
  }

  return {
    skills: skills.filter((skill) => selected.names.includes(skill.name)),
    isAll: selected.isAll,
  };
}

export function createInstallResult(
  installedPaths: string[],
  sourceKeys: string[],
  extra: Partial<InstallResult> = {},
): InstallResult {
  return {
    basePath: installedPaths[0] ?? '',
    sourceKey: sourceKeys[0] ?? '',
    installedPaths,
    sourceKeys,
    ...extra,
  };
}

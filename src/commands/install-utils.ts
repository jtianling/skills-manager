import { basename, join } from 'path';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import type { InstallOptions } from '../types.js';
import { SourcesService } from '../services/sources.js';
import { fileExists, getDirectoriesInDir, readFileContent, removeDir } from '../utils/fs.js';
import { promptConfirm, promptSkillsToInstall } from '../utils/prompts.js';

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

export function validateGroupName(group?: string): void {
  if (group && !/^[a-zA-Z0-9_-]+$/.test(group)) {
    throw new Error('Group name must contain only letters, numbers, hyphens, and underscores');
  }
}

export function getCustomSkillDir(skillName: string, group?: string): string {
  return group
    ? join(SKILLS_MANAGER_DIR, 'custom', group, skillName)
    : join(SKILLS_MANAGER_DIR, 'custom', skillName);
}

export function getCustomSkillKey(skillName: string, group?: string): string {
  return group ? `custom/${group}/${skillName}` : `custom/${skillName}`;
}

function getGitSourceInfo(owner: string, repo: string, options: InstallOptions): {
  type: 'official' | 'community' | 'custom';
  sourceKey: string;
} {
  const officialMatch = findOfficialProvider(owner, repo);

  if (officialMatch) {
    return {
      type: 'official',
      sourceKey: `official/${officialMatch.providerKey}/${repo}`,
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

export function saveGroupedGitSource(skillName: string, owner: string, repo: string, options: InstallOptions): string {
  const { type } = getGitSourceInfo(owner, repo, options);
  const sourceKey = getCustomSkillKey(skillName, options.group);
  sourcesService.addSource(sourceKey, {
    url: `https://github.com/${owner}/${repo}`,
    type,
    repoName: repo,
    installMethod: 'git',
  });
  return sourceKey;
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
  if (options.group) {
    return getCustomSkillDir(skillName, options.group);
  }

  const officialMatch = findOfficialProvider(owner, repo);
  if (officialMatch) {
    return join(SKILLS_MANAGER_DIR, 'official', officialMatch.providerKey, repo, skillName);
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

export function getLocalOverwriteMessage(skillName: string, group?: string): string {
  return group
    ? `Skill '${skillName}' already exists in group '${group}'. Overwrite?`
    : `Skill '${skillName}' already exists. Overwrite?`;
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

export async function selectSkills(skills: InstallableSkill[], options: InstallOptions): Promise<InstallableSkill[]> {
  if (options.all || skills.length <= 1) {
    return skills;
  }

  const selectedNames = await promptSkillsToInstall(skills);
  if (selectedNames.length === 0) {
    console.log('No skills selected');
    return [];
  }

  return skills.filter((skill) => selectedNames.includes(skill.name));
}

export function createInstallResult(installedPaths: string[], sourceKeys: string[]): InstallResult {
  return {
    basePath: installedPaths[0] ?? '',
    sourceKey: sourceKeys[0] ?? '',
    installedPaths,
    sourceKeys,
  };
}

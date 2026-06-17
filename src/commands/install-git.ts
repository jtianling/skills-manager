import { basename, join } from 'path';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { SourcesService } from '../services/sources.js';
import type { InstallOptions } from '../types.js';
import { copyDir, fileExists, findScriptFiles, getDirectoriesInDir, warnScriptFiles } from '../utils/fs.js';
import { cloneRepoToTemp, collectSkillsFromClone } from '../services/repo-clone.js';
import { makeBundleId, normalizeGitUrl } from '../utils/url-normalize.js';
import {
  createInstallResult,
  getLocalOverwriteMessage,
  prepareTargetDir,
  selectSkills,
} from './install-utils.js';
import type { InstallableSkill, InstallResult } from './install-utils.js';

const sourcesService = new SourcesService();

function buildGitSourceUrl(source: string, resolvedOwner?: string, resolvedRepo?: string): string {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  if (/^[^/]+\/[^/]+\/?$/.test(source)) {
    return `https://github.com/${source.replace(/\/$/, '')}`;
  }

  if (resolvedOwner && resolvedRepo) {
    return `https://github.com/${resolvedOwner}/${resolvedRepo}`;
  }

  return source;
}

function parseGitHubIdentity(source: string): { owner?: string; repo?: string } {
  const match = source.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!match) {
    return {};
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

export const collectGitCloneSkills = collectSkillsFromClone;

export function saveGitCloneSource(
  source: string,
  repoPath: string,
  options: InstallOptions,
  resolvedOwner?: string,
  resolvedRepo?: string,
  commitSha?: string,
): string {
  const repoName = basename(repoPath) || source;

  let type: 'official' | 'community' | 'custom';
  let sourceKey: string;

  const providerKey = resolvedOwner
    ? findOfficialProvider(resolvedOwner)
    : null;

  if (providerKey || repoPath.includes('/official/')) {
    type = 'official';
    const repo = resolvedRepo || repoName;
    sourceKey = `official/${providerKey || repoName}/${repo}`;
  } else if (options.custom || repoPath.includes('/custom/')) {
    type = 'custom';
    sourceKey = `custom/${repoName}`;
  } else {
    type = 'community';
    const owner = resolvedOwner || repoName;
    const repo = resolvedRepo || repoName;
    sourceKey = `community/${owner}/${repo}`;
  }

  sourcesService.addSource(sourceKey, {
    url: buildGitSourceUrl(source, resolvedOwner, resolvedRepo),
    type,
    repoName: resolvedRepo || repoName,
    installMethod: 'git',
    ...(commitSha ? { version: commitSha } : {}),
  });

  return sourceKey;
}

interface GitCloneContext {
  options: InstallOptions;
  resolvedOwner?: string;
  resolvedRepo?: string;
  source: string;
}

function createGitCloneContext(source: string, options: InstallOptions): GitCloneContext {
  const { owner: resolvedOwner, repo: resolvedRepo } = parseGitHubIdentity(source);
  return { source, options, resolvedOwner, resolvedRepo };
}

function parseTreeUrl(url: string): { owner: string; repo: string; branch: string; skillPath: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3], skillPath: match[4] };
}

function isSpecificSkillUrl(url: string): boolean {
  return url.includes('/tree/');
}

async function installSpecificSkillFromGit(
  context: GitCloneContext,
): Promise<InstallResult> {
  const parsed = parseTreeUrl(context.source);
  if (!parsed) {
    throw new Error('Failed to parse skill URL');
  }

  const { skillPath } = parsed;
  const skillName = basename(skillPath);
  const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;

  const cloned = await cloneRepoToTemp(context.source);
  const { repoPath } = cloned;

  try {
    let sourceSkillDir = join(repoPath, skillPath);
    if (!fileExists(sourceSkillDir)) {
      // Fallback: search by skill name in the downloaded repo
      const skills = collectGitCloneSkills(repoPath);
      const match = skills.find((s) => s.name === skillName);
      if (!match) {
        throw new Error(`Skill '${skillName}' not found in repository`);
      }
      sourceSkillDir = match.path;
    }

    const targetBase = computeRepoTargetBase(context);
    const targetDir = join(targetBase, skillName);

    const ready = await prepareTargetDir(targetDir, getLocalOverwriteMessage(skillName), context.options.force);
    if (!ready) return createInstallResult([], []);

    copyDir(sourceSkillDir, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));
    console.log(`✓ Installed skill to ${targetDir}`);

    const sourceKey = saveGitCloneSource(
      repoUrl,
      targetBase,
      context.options,
      context.resolvedOwner,
      context.resolvedRepo,
      cloned.commitSha,
    );

    return createInstallResult([targetDir], [sourceKey]);
  } finally {
    cloned.cleanup();
  }
}

function computeRepoTargetBase(context: GitCloneContext): string {
  const { options, resolvedOwner, resolvedRepo, source } = context;
  const repoNameMatch = source.match(/\/([^/]+?)(?:\.git)?$/);
  const repoName = resolvedRepo || (repoNameMatch ? repoNameMatch[1] : 'unknown');
  const providerKey = resolvedOwner ? findOfficialProvider(resolvedOwner) : null;

  if (providerKey) {
    return join(SKILLS_MANAGER_DIR, 'official', providerKey, repoName);
  }
  if (options.custom) {
    return join(SKILLS_MANAGER_DIR, 'custom', repoName);
  }
  return join(SKILLS_MANAGER_DIR, 'community', resolvedOwner || repoName, repoName);
}

function createGitBundleInfo(
  context: GitCloneContext,
  members: string[],
  isAll: boolean,
): InstallResult['bundleInfo'] {
  const url = buildGitSourceUrl(
    context.source,
    context.resolvedOwner,
    context.resolvedRepo,
  );
  const normalizedUrl = normalizeGitUrl(url) ?? url;

  return {
    id: makeBundleId('git', normalizedUrl),
    info: {
      type: 'git',
      url: normalizedUrl,
      selectionMode: isAll ? 'all' : 'subset',
      members,
    },
  };
}

async function installRepoWithSelection(context: GitCloneContext): Promise<InstallResult> {
  const cloned = await cloneRepoToTemp(context.source);
  const { repoPath } = cloned;

  try {
    const skills = collectGitCloneSkills(repoPath);
    if (skills.length === 0) {
      throw new Error('No skills found in repository');
    }

    const targetBase = computeRepoTargetBase(context);
    const installedNames = new Set(
      getDirectoriesInDir(targetBase)
        .filter((d) => fileExists(join(d.path, 'SKILL.md')))
        .map((d) => d.name),
    );

    let selectedSkills: InstallableSkill[];
    let isAll = false;
    if (context.options.skill?.length) {
      const selected = await selectSkills(skills, context.options);
      selectedSkills = selected.skills;
      isAll = selected.isAll;
      console.log(`Found ${selectedSkills.length} skill${selectedSkills.length === 1 ? '' : 's'}.\n`);
    } else {
      console.log(`Found ${skills.length} skill${skills.length === 1 ? '' : 's'}.\n`);
      const selected = context.options.all
        ? { skills, isAll: true }
        : await selectSkills(skills, context.options, installedNames);
      selectedSkills = selected.skills;
      isAll = selected.isAll;
    }
    if (selectedSkills.length === 0) {
      return createInstallResult([], []);
    }

    const installedPaths: string[] = [];
    const allScriptFiles: string[] = [];

    for (const skill of selectedSkills) {
      const targetDir = join(targetBase, skill.name);
      const ready = await prepareTargetDir(
        targetDir,
        getLocalOverwriteMessage(skill.name),
        context.options.force,
      );
      if (!ready) break;

      copyDir(skill.path, targetDir);
      installedPaths.push(targetDir);
      allScriptFiles.push(...findScriptFiles(targetDir));
    }

    warnScriptFiles(allScriptFiles);

    const sourceKey = saveGitCloneSource(
      context.source,
      targetBase,
      context.options,
      context.resolvedOwner,
      context.resolvedRepo,
      cloned.commitSha,
    );

    console.log(`\n✓ Installed ${installedPaths.length} skill${installedPaths.length === 1 ? '' : 's'} to ${targetBase}`);
    return createInstallResult(installedPaths, [sourceKey], {
      bundleInfo: createGitBundleInfo(context, [sourceKey], isAll),
    });
  } finally {
    cloned.cleanup();
  }
}

export async function installViaGitClone(source: string, options: InstallOptions): Promise<InstallResult> {
  const context = createGitCloneContext(source, options);

  if (isSpecificSkillUrl(source)) {
    return installSpecificSkillFromGit(context);
  }

  return installRepoWithSelection(context);
}

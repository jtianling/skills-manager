import { execFileSync } from 'child_process';
import { basename, dirname, join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { SKILLS_MANAGER_DIR, STANDARD_SKILL_PATHS, findOfficialProvider } from '../constants.js';
import { GitService } from '../services/git.js';
import { SourcesService } from '../services/sources.js';
import type { InstallOptions } from '../types.js';
import { copyDir, fileExists, findScriptFiles, getDirectoriesInDir, readFileContent, removeDir, warnScriptFiles } from '../utils/fs.js';
import { getPluginSkillPaths } from '../services/plugin-manifest.js';
import {
  createInstallResult,
  getLocalOverwriteMessage,
  parseMdFrontmatter,
  parseMdDescription,
  prepareTargetDir,
  scanSkillDirectories,
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

export async function cloneToTemp(source: string): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-git-'));
  const repoDir = join(tempDir, 'repo');
  execFileSync('git', ['clone', '--depth', '1', source, repoDir], { stdio: 'pipe' });
  return tempDir;
}

function discoverManifestSkills(repoPath: string): InstallableSkill[] {
  const manifestDirs = getPluginSkillPaths(repoPath);
  if (manifestDirs.length === 0) {
    return [];
  }

  const skills: InstallableSkill[] = [];
  const seenNames = new Set<string>();

  for (const dir of manifestDirs) {
    for (const skill of scanSkillDirectories(dir)) {
      if (!seenNames.has(skill.name)) {
        seenNames.add(skill.name);
        skills.push(skill);
      }
    }
  }

  return skills;
}

function mergeSkills(base: InstallableSkill[], extra: InstallableSkill[]): InstallableSkill[] {
  const seenNames = new Set(base.map((s) => s.name));
  const merged = [...base];

  for (const skill of extra) {
    if (!seenNames.has(skill.name)) {
      seenNames.add(skill.name);
      merged.push(skill);
    }
  }

  return merged;
}

export function collectGitCloneSkills(repoPath: string): InstallableSkill[] {
  const manifestSkills = discoverManifestSkills(repoPath);

  let scannedSkills: InstallableSkill[] = [];
  for (const stdPath of STANDARD_SKILL_PATHS) {
    const dir = join(repoPath, stdPath);
    if (fileExists(dir)) {
      scannedSkills = mergeSkills(scannedSkills, scanForSkills(dir, 3));
    }
  }

  let skills = mergeSkills(manifestSkills, scannedSkills);

  if (skills.length === 0) {
    const rootSkillMd = join(repoPath, 'SKILL.md');
    if (fileExists(rootSkillMd)) {
      const content = readFileContent(rootSkillMd);
      const frontmatter = parseMdFrontmatter(content);
      skills = [{
        name: frontmatter.name || basename(repoPath),
        description: frontmatter.description ?? '',
        path: repoPath,
      }];
    } else {
      skills = scanForSkills(repoPath, 1);
    }
  }

  return skills;
}

function scanForSkills(dir: string, maxDepth: number): InstallableSkill[] {
  const skills: InstallableSkill[] = [];

  for (const subdir of getDirectoriesInDir(dir)) {
    const skillMdPath = join(subdir.path, 'SKILL.md');
    if (fileExists(skillMdPath)) {
      const content = readFileContent(skillMdPath);
      skills.push({ name: subdir.name, description: parseMdDescription(content), path: subdir.path });
    } else if (maxDepth > 1) {
      skills.push(...scanForSkills(subdir.path, maxDepth - 1));
    }
  }

  return skills;
}

export function saveGitCloneSource(
  source: string,
  repoPath: string,
  options: InstallOptions,
  resolvedOwner?: string,
  resolvedRepo?: string,
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

async function installSpecificSkillFromGit(
  gitService: GitService,
  context: GitCloneContext,
): Promise<InstallResult> {
  const skillPath = gitService.cloneSpecificSkill(context.source, context.options.custom || false);
  if (!skillPath) {
    throw new Error('Failed to parse skill URL');
  }

  warnScriptFiles(findScriptFiles(skillPath));
  console.log(`✓ Installed skill to ${skillPath}`);

  const repoBase = dirname(skillPath);
  const sourceKey = saveGitCloneSource(
    context.source,
    repoBase,
    context.options,
    context.resolvedOwner,
    context.resolvedRepo,
  );

  return createInstallResult([skillPath], [sourceKey]);
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

async function installRepoWithSelection(context: GitCloneContext): Promise<InstallResult> {
  const tempDir = await cloneToTemp(context.source);
  const repoPath = join(tempDir, 'repo');

  try {
    const skills = collectGitCloneSkills(repoPath);
    if (skills.length === 0) {
      throw new Error('No skills found in repository');
    }

    let selectedSkills: InstallableSkill[];
    if (context.options.skill?.length) {
      selectedSkills = await selectSkills(skills, context.options);
      console.log(`Found ${selectedSkills.length} skill${selectedSkills.length === 1 ? '' : 's'}.\n`);
    } else {
      console.log(`Found ${skills.length} skill${skills.length === 1 ? '' : 's'}.\n`);
      selectedSkills = context.options.all
        ? skills
        : await selectSkills(skills, context.options);
    }
    if (selectedSkills.length === 0) {
      return createInstallResult([], []);
    }

    const targetBase = computeRepoTargetBase(context);
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
    );

    console.log(`\n✓ Installed ${installedPaths.length} skill${installedPaths.length === 1 ? '' : 's'} to ${targetBase}`);
    return createInstallResult(installedPaths, [sourceKey]);
  } finally {
    removeDir(tempDir);
  }
}

export async function installViaGitClone(source: string, options: InstallOptions): Promise<InstallResult> {
  const context = createGitCloneContext(source, options);
  const gitService = new GitService();

  if (gitService.isSpecificSkillUrl(source)) {
    return installSpecificSkillFromGit(gitService, context);
  }

  return installRepoWithSelection(context);
}

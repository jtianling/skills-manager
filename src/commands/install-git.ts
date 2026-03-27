import { execFileSync } from 'child_process';
import { basename, dirname, join } from 'path';
import { mkdtempSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { GitService } from '../services/git.js';
import { SourcesService } from '../services/sources.js';
import type { InstallOptions } from '../types.js';
import { copyDir, fileExists, findScriptFiles, getDirectoriesInDir, readFileContent, removeDir, warnScriptFiles } from '../utils/fs.js';
import {
  createInstallResult,
  getCustomSkillDir,
  getCustomSkillKey,
  getLocalOverwriteMessage,
  parseMdFrontmatter,
  parseMdDescription,
  prepareTargetDir,
  saveGroupedGitSource,
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

export function collectGitCloneSkills(repoPath: string): InstallableSkill[] {
  const skillsSubdir = join(repoPath, 'skills');
  const scanRoot = fileExists(skillsSubdir) ? skillsSubdir : repoPath;
  let skills = scanForSkills(scanRoot, 3);

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

  const officialMatch = resolvedOwner && resolvedRepo
    ? findOfficialProvider(resolvedOwner, resolvedRepo)
    : null;

  if (officialMatch || repoPath.includes('/official/')) {
    type = 'official';
    const providerKey = officialMatch?.providerKey || repoName;
    const repo = resolvedRepo || repoName;
    sourceKey = `official/${providerKey}/${repo}`;
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

function saveGroupedGitCloneSource(skillName: string, context: GitCloneContext): string {
  const { options, resolvedOwner, resolvedRepo, source } = context;
  if (resolvedOwner && resolvedRepo) {
    return saveGroupedGitSource(skillName, resolvedOwner, resolvedRepo, options);
  }

  const sourceKey = getCustomSkillKey(skillName, options.group);
  sourcesService.addSource(sourceKey, {
    url: source,
    type: 'custom',
    repoName: skillName,
    installMethod: 'git',
  });
  return sourceKey;
}

async function installGroupedFromGitClone(context: GitCloneContext): Promise<InstallResult> {
  const tempDir = await cloneToTemp(context.source);
  const repoPath = join(tempDir, 'repo');

  try {
    const skills = collectGitCloneSkills(repoPath);
    if (skills.length === 0) {
      throw new Error('No skills found in repository');
    }

    const selectedSkills = await selectSkills(skills, context.options);
    if (selectedSkills.length === 0) {
      return createInstallResult([], []);
    }

    const installedPaths: string[] = [];
    const sourceKeys: string[] = [];
    const allScriptFiles: string[] = [];

    for (const skill of selectedSkills) {
      const targetDir = getCustomSkillDir(skill.name, context.options.group);
      const ready = await prepareTargetDir(
        targetDir,
        getLocalOverwriteMessage(skill.name, context.options.group),
        context.options.force,
      );
      if (!ready) {
        break;
      }

      copyDir(skill.path, targetDir);
      installedPaths.push(targetDir);
      sourceKeys.push(saveGroupedGitCloneSource(skill.name, context));
      allScriptFiles.push(...findScriptFiles(targetDir));
    }

    warnScriptFiles(allScriptFiles);
    console.log(`✓ Installed ${installedPaths.length} skills to ${join(SKILLS_MANAGER_DIR, 'custom', context.options.group)}`);
    return createInstallResult(installedPaths, sourceKeys);
  } finally {
    removeDir(tempDir);
  }
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

function flattenClonedSkillPaths(repoPath: string, skillsRoot: string, skills: InstallableSkill[]): void {
  const groupDirsToClean = new Set<string>();

  for (const skill of skills) {
    const parentDir = dirname(skill.path);
    const isNested = parentDir !== repoPath && parentDir !== skillsRoot;
    if (!isNested) {
      continue;
    }

    const flatPath = join(repoPath, skill.name);
    if (fileExists(flatPath)) {
      continue;
    }

    renameSync(skill.path, flatPath);
    skill.path = flatPath;
    groupDirsToClean.add(parentDir);
  }

  for (const groupDir of groupDirsToClean) {
    if (fileExists(groupDir) && readdirSync(groupDir).length === 0) {
      removeDir(groupDir);
    }
  }

  if (skillsRoot !== repoPath && fileExists(skillsRoot) && readdirSync(skillsRoot).length === 0) {
    removeDir(skillsRoot);
  }
}

function tryInstallRootSkillFromClone(repoPath: string, context: GitCloneContext): InstallResult | null {
  const rootSkillMd = join(repoPath, 'SKILL.md');
  if (!fileExists(rootSkillMd)) {
    return null;
  }

  const content = readFileContent(rootSkillMd);
  const frontmatter = parseMdFrontmatter(content);
  const repoName = basename(repoPath) || context.source;
  const skillName = frontmatter.name || repoName;

  console.log(`Found root skill: ${skillName}`);

  const skillSubdir = join(repoPath, skillName);
  mkdirSync(skillSubdir, { recursive: true });

  for (const entry of readdirSync(repoPath, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === skillName) {
      continue;
    }

    renameSync(join(repoPath, entry.name), join(skillSubdir, entry.name));
  }

  removeDir(join(repoPath, '.git'));
  warnScriptFiles(findScriptFiles(repoPath));
  console.log(`✓ Installed 1 skill to ${repoPath}`);

  const sourceKey = saveGitCloneSource(
    context.source,
    repoPath,
    context.options,
    context.resolvedOwner,
    context.resolvedRepo,
  );

  return createInstallResult([skillSubdir], [sourceKey]);
}

function findRepoSkills(repoPath: string): InstallableSkill[] {
  const skillsRoot = fileExists(join(repoPath, 'skills')) ? join(repoPath, 'skills') : repoPath;
  const skills = scanForSkills(skillsRoot, 2);
  flattenClonedSkillPaths(repoPath, skillsRoot, skills);
  return skills;
}

function finalizeRepoInstall(repoPath: string, skills: InstallableSkill[], context: GitCloneContext): InstallResult {
  warnScriptFiles(findScriptFiles(repoPath));
  console.log(`✓ Installed ${skills.length} skills to ${repoPath}`);

  const sourceKey = saveGitCloneSource(
    context.source,
    repoPath,
    context.options,
    context.resolvedOwner,
    context.resolvedRepo,
  );

  return createInstallResult(skills.map((skill) => skill.path), [sourceKey]);
}

async function installRepoWithSelection(gitService: GitService, context: GitCloneContext): Promise<InstallResult> {
  const repoPath = gitService.clone(context.source, context.options.custom || false);
  const skills = findRepoSkills(repoPath);

  if (skills.length === 0) {
    const rootSkillResult = tryInstallRootSkillFromClone(repoPath, context);
    if (rootSkillResult) {
      return rootSkillResult;
    }

    throw new Error('No skills found in repository');
  }

  console.log(`Found ${skills.length} skills.\n`);
  if (context.options.all) {
    return finalizeRepoInstall(repoPath, skills, context);
  }

  const selectedSkills = await selectSkills(skills, context.options);
  if (selectedSkills.length === 0) {
    removeDir(repoPath);
    return createInstallResult([], []);
  }

  const selectedNames = new Set(selectedSkills.map((skill) => skill.name));
  for (const skill of skills) {
    if (!selectedNames.has(skill.name)) {
      removeDir(skill.path);
    }
  }

  warnScriptFiles(findScriptFiles(repoPath));
  console.log(`\n✓ Installed ${selectedSkills.length} skills to ${repoPath}`);

  const sourceKey = saveGitCloneSource(
    context.source,
    repoPath,
    context.options,
    context.resolvedOwner,
    context.resolvedRepo,
  );

  return createInstallResult(selectedSkills.map((skill) => skill.path), [sourceKey]);
}

export async function installViaGitClone(source: string, options: InstallOptions): Promise<InstallResult> {
  const context = createGitCloneContext(source, options);
  const gitService = new GitService();

  if (options.group) {
    return installGroupedFromGitClone(context);
  }

  if (gitService.isSpecificSkillUrl(source)) {
    return installSpecificSkillFromGit(gitService, context);
  }

  return installRepoWithSelection(gitService, context);
}

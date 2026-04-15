import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { BundleManager } from '../services/bundle-manager.js';
import { GroupManager } from '../services/group-manager.js';
import { GitHubService } from '../services/github.js';
import { SkillsService } from '../services/skills.js';
import { SourcesService } from '../services/sources.js';
import { GroupsService } from '../services/groups.js';
import { ResolvedTarget, SourceResolver } from '../services/source-resolver.js';
import { cleanEmptyParents, fileExists, removeDir, getDirectoriesInDir } from '../utils/fs.js';
import {
  loadGroupsData,
  promptConfirm,
  promptSkillsToUninstall,
} from '../utils/prompts.js';
import { SkillInfo, collect } from '../types.js';
import { resolveSkillByName } from '../utils/skill-resolve.js';
import { ensureSetup } from './setup.js';

interface UninstallOptions {
  all?: boolean;
  force?: boolean;
  y?: boolean;
  skill?: string[];
}

function cleanSourcesForDir(dirPrefix: string, service?: SourcesService): void {
  const sourcesService = service ?? new SourcesService();
  const allSources = sourcesService.getAllSources();
  for (const key of Object.keys(allSources)) {
    if (key === dirPrefix || key.startsWith(dirPrefix + '/')) {
      const sourceDir = join(SKILLS_MANAGER_DIR, key);
      if (!fileExists(sourceDir) || getDirectoriesInDir(sourceDir).length === 0) {
        sourcesService.removeSource(key);
      }
    }
  }
}

function printWarning(): void {
  console.log('\nWarning: Symlinked deployments in projects will break.');
  console.log('Use `skillsmgr remove <name>` in affected projects first.\n');
}

function isExplicitLocalPath(input: string): boolean {
  return input === '~' || ['/', './', '../', '~/'].some((prefix) => input.startsWith(prefix));
}

async function confirmUninstall(skillNames: string[], force: boolean): Promise<boolean> {
  console.log(`\nSkills to uninstall:`);
  for (const name of skillNames) {
    console.log(`  - ${name}`);
  }
  printWarning();

  if (force) return true;
  return promptConfirm('Confirm uninstall?', false);
}

function removeSkills(
  skills: SkillInfo[],
  sourcesService: SourcesService,
  groupsService: GroupsService
): void {
  for (const skill of skills) {
    removeDir(skill.path);

    const skillParent = join(skill.path, '..');
    const sourceParts = skill.source.split('/');
    const categoryDir = join(SKILLS_MANAGER_DIR, sourceParts[0]);

    cleanEmptyParents(skillParent, categoryDir);
    cleanSourcesForDir(skill.source, sourcesService);
    groupsService.removeSkillFromAll(`${skill.source}/${skill.name}`);
    console.log(`Removed: ${skill.name}`);
  }
}

async function uninstallSourceTarget(
  target: ResolvedTarget,
  identifier: string,
  options: UninstallOptions
): Promise<void> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const sourcesService = new SourcesService();
  const sourceSkills = skillsService
    .getAllSkills()
    .filter(
      (skill) =>
        target.sourceKeys.includes(skill.source) ||
        target.sourceKeys.includes(`${skill.source}/${skill.name}`)
    );

  if (sourceSkills.length === 0) {
    console.error(`Error: No installed skills found for '${identifier}'`);
    process.exit(1);
  }

  const groupsService = new GroupsService();

  let selectedSkills = sourceSkills;
  if (!options.all && sourceSkills.length > 1) {
    const selectedPaths = await promptSkillsToUninstall(
      sourceSkills,
      loadGroupsData(groupsService),
    );
    if (selectedPaths.length === 0) {
      console.log('No skills selected.');
      return;
    }

    const selectedPathSet = new Set(selectedPaths);
    selectedSkills = sourceSkills.filter((skill) => selectedPathSet.has(skill.path));
  }

  const confirmed = await confirmUninstall(
    selectedSkills.map((skill) => skill.name),
    options.force ?? false
  );
  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  removeSkills(selectedSkills, sourcesService, groupsService);

  const s = selectedSkills.length === 1 ? '' : 's';
  console.log(`Uninstalled ${selectedSkills.length} skill${s} from ${identifier}`);
}

async function uninstallExplicitSkillName(name: string, options: UninstallOptions): Promise<void> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const sourcesService = new SourcesService();
  const allSkills = skillsService.getAllSkills();
  const skill = await resolveSkillByName(name, allSkills);

  if (!skill) {
    console.error(`Error: Skill '${name}' not found`);
    process.exit(1);
  }

  const confirmed = await confirmUninstall([`${skill.name} (${skill.source})`], options.force ?? false);
  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  const skillParent = join(skill.path, '..');
  removeDir(skill.path);

  const sourceParts = skill.source.split('/');
  const categoryDir = join(SKILLS_MANAGER_DIR, sourceParts[0]);
  cleanEmptyParents(skillParent, categoryDir);

  const sourceDir = join(SKILLS_MANAGER_DIR, skill.source);
  if (!fileExists(sourceDir) || getDirectoriesInDir(sourceDir).length === 0) {
    sourcesService.removeSource(skill.source);
  }

  const groupsService = new GroupsService();
  groupsService.removeSkillFromAll(`${skill.source}/${skill.name}`);

  console.log(`Uninstalled ${skill.name}`);
}

async function uninstallResolvedSkills(
  target: ResolvedTarget,
  options: UninstallOptions
): Promise<void> {
  const skills = target.skills ?? [];
  if (skills.length === 0) {
    console.error(`Error: Skill '${target.originalInput}' not found`);
    process.exit(1);
  }

  const confirmed = await confirmUninstall(
    skills.map((skill) => `${skill.name} (${skill.source})`),
    options.force ?? false
  );
  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  const sourcesService = new SourcesService();
  const groupsService = new GroupsService();
  removeSkills(skills, sourcesService, groupsService);

  if (skills.length === 1) {
    console.log(`Uninstalled ${skills[0].name}`);
    return;
  }

  console.log(`Uninstalled ${skills.length} skills.`);
}

function resolveBundleSkillNames(
  target: ResolvedTarget,
  skillsService: SkillsService,
): string[] {
  const skills = skillsService
    .getAllSkills()
    .filter(
      (skill) =>
        target.sourceKeys.includes(skill.source) ||
        target.sourceKeys.includes(`${skill.source}/${skill.name}`),
    )
    .map((skill) => skill.name);

  if (skills.length > 0) {
    return [...new Set(skills)].sort();
  }

  return target.sourceKeys
    .map((key) => key.split('/').pop() ?? key)
    .sort();
}

function printUninstallNotFound(identifier: string, target: ResolvedTarget): void {
  if (isExplicitLocalPath(identifier) && target.reason) {
    console.error(`Error: ${target.reason}`);
    process.exit(1);
  }

  if (!identifier.includes('/')) {
    console.error(`Error: Skill '${identifier}' not found`);
    process.exit(1);
  }

  console.error(`Error: ${target.reason ?? `No installed skills found for '${identifier}'`}`);
  process.exit(1);
}

async function interactiveUninstall(): Promise<void> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const sourcesService = new SourcesService();
  const groupsService = new GroupsService();
  const allSkills = skillsService.getAllSkills();

  if (allSkills.length === 0) {
    console.log('No installed skills found.');
    return;
  }

  const selectedPaths = await promptSkillsToUninstall(
    allSkills,
    loadGroupsData(groupsService),
  );
  if (selectedPaths.length === 0) {
    console.log('No skills selected.');
    return;
  }

  const selectedPathSet = new Set(selectedPaths);
  const selectedSkills = allSkills.filter((skill) => selectedPathSet.has(skill.path));
  const confirmed = await confirmUninstall(
    selectedSkills.map((skill) => skill.name),
    false
  );
  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  removeSkills(selectedSkills, sourcesService, groupsService);

  console.log(`Uninstalled ${selectedSkills.length} skills.`);
}

export async function executeUninstall(
  identifier: string | undefined,
  options: UninstallOptions
): Promise<void> {
  if (options.y) {
    if (!options.all) options.all = true;
    if (!options.force) options.force = true;
  }

  await ensureSetup();

  if (options.skill && options.skill.length > 0) {
    for (const name of options.skill) {
      await uninstallExplicitSkillName(name, options);
    }
    return;
  }

  if (identifier === undefined) {
    await interactiveUninstall();
    return;
  }

  const resolver = new SourceResolver(
    new SourcesService(),
    new SkillsService(SKILLS_MANAGER_DIR),
    new GitHubService()
  );
  const target = await resolver.resolve(identifier);

  if (target.kind === 'not-found') {
    printUninstallNotFound(identifier, target);
    return;
  }

  if (target.kind === 'bundle') {
    const bundleId = target.bundleId;
    if (!bundleId) {
      throw new Error(`Missing bundle id for ${identifier}`);
    }

    const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
    const skillNames = resolveBundleSkillNames(target, skillsService);
    const confirmed = await confirmUninstall(skillNames, options.force ?? false);
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }

    const bundleManager = new BundleManager(
      new SourcesService(),
      new GitHubService(),
      new GroupsService(),
    );
    const result = await bundleManager.remove(bundleId);
    console.log(`Uninstalled ${result.removed} skills from bundle ${bundleId}`);
    return;
  }

  if (target.kind === 'group') {
    if (!target.groupName || !target.groupKind) {
      throw new Error(`Missing group metadata for ${identifier}`);
    }

    if (target.groupKind === 'virtual') {
      console.error(
        `Error: '${target.groupName}' is a virtual group; use 'group delete ${target.groupName}' to remove it (skills are not affected)`,
      );
      process.exit(1);
    }

    const groupManager = new GroupManager(
      new SourcesService(),
      new GroupsService(),
      new GitHubService(),
    );
    const result = await groupManager.uninstallPhysicalGroup(target.groupName, {
      force: options.force,
    });
    if (result.removed > 0) {
      console.log(`Uninstalled ${result.removed} skills from physical group ${target.groupName}`);
    }
    return;
  }

  if (target.kind === 'source') {
    await uninstallSourceTarget(target, identifier, options);
    return;
  }

  await uninstallResolvedSkills(target, options);
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove skills from ~/.skills-manager/')
  .argument('[identifier]', 'owner/repo or skill name')
  .option('--all', 'Skip selection prompt and uninstall all matching skills')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('-y', 'Skip all prompts (implies --all --force)')
  .option('-s, --skill <name>', 'Specific skill to uninstall (repeatable)', collect, [])
  .action(async (identifier: string | undefined, options: UninstallOptions) => {
    await executeUninstall(identifier, options);
  });

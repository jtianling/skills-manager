import { Command } from 'commander';
import { join } from 'path';
import { readdirSync } from 'fs';
import { SKILLS_MANAGER_DIR, findOfficialProvider } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { SourcesService } from '../services/sources.js';
import { GroupsService } from '../services/groups.js';
import { fileExists, removeDir, getDirectoriesInDir } from '../utils/fs.js';
import { extractOwnerRepo } from '../utils/source-detection.js';
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
  yes?: boolean;
  skill?: string[];
}

function cleanEmptyParents(dir: string, stopAt: string): void {
  let current = dir;
  while (current !== stopAt && current.startsWith(stopAt)) {
    if (!fileExists(current)) {
      current = join(current, '..');
      continue;
    }
    const entries = readdirSync(current);
    if (entries.length === 0) {
      removeDir(current);
      current = join(current, '..');
    } else {
      break;
    }
  }
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

async function uninstallSource(owner: string, repo: string, options: UninstallOptions): Promise<void> {
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const sourcesService = new SourcesService();
  const providerKey = findOfficialProvider(owner);
  const resolvedOwner = providerKey ?? owner;
  const sourceKey = ['official', 'community']
    .map((source) => `${source}/${resolvedOwner}/${repo}`)
    .find((source) => fileExists(join(SKILLS_MANAGER_DIR, source)));

  if (!sourceKey) {
    console.error(`Error: No installed skills found for '${owner}/${repo}'`);
    process.exit(1);
  }

  const sourceSkills = skillsService
    .getAllSkills()
    .filter((skill) => skill.source === sourceKey);

  if (sourceSkills.length === 0) {
    console.error(`Error: No skills found under '${owner}/${repo}'`);
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
  console.log(`Uninstalled ${selectedSkills.length} skill${s} from ${owner}/${repo}`);
}

async function uninstallByName(name: string, options: UninstallOptions): Promise<void> {
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
  if (options.yes) {
    options.all = true;
    options.force = true;
  }

  await ensureSetup();

  if (options.skill && options.skill.length > 0) {
    for (const name of options.skill) {
      await uninstallByName(name, options);
    }
    return;
  }

  if (identifier === undefined) {
    await interactiveUninstall();
    return;
  }

  const ownerRepo = extractOwnerRepo(identifier);
  if (ownerRepo) {
    const [owner, repo] = ownerRepo.split('/');
    await uninstallSource(owner, repo, options);
    return;
  }

  await uninstallByName(identifier, options);
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove skills from ~/.skills-manager/')
  .argument('[identifier]', 'owner/repo or skill name')
  .option('--all', 'Skip selection prompt and uninstall all matching skills')
  .option('-f, --force', 'Skip confirmation prompt')
  .option('-y, --yes', 'Skip all prompts (equivalent to --all --force)')
  .option('-s, --skill <name>', 'Specific skill to uninstall (repeatable)', collect, [])
  .action(async (identifier: string | undefined, options: UninstallOptions) => {
    await executeUninstall(identifier, options);
  });

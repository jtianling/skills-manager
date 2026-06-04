import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { SourcesService } from '../services/sources.js';
import { GroupsService } from '../services/groups.js';
import { DeploymentScanner } from '../services/scanner.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ListOptions, SkillInfo } from '../types.js';
import { ensureSetup } from './setup.js';
import { jsonOutput } from '../utils/json-output.js';

function buildSkillKeyToCollections(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const groupsService = new GroupsService();
  for (const name of groupsService.listGroups()) {
    const group = groupsService.getGroup(name);
    if (!group || group.kind !== 'collection') continue;
    for (const memberKey of group.members) {
      const list = map.get(memberKey) ?? [];
      list.push(group.ref);
      map.set(memberKey, list);
    }
  }
  return map;
}

function buildSkillKeyToVirtualGroups(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const groupsService = new GroupsService();
  for (const name of groupsService.listGroups()) {
    if (groupsService.getGroupKind(name) !== 'virtual') continue;
    for (const memberKey of groupsService.getGroupMembers(name)) {
      const list = map.get(memberKey) ?? [];
      list.push(name);
      map.set(memberKey, list);
    }
  }
  return map;
}

export function renderAvailableBody(
  skills: SkillInfo[],
  skillToCollections: Map<string, string[]>,
  skillToVirtualGroups: Map<string, string[]>,
): string[] {
  const byCategory: Record<string, Record<string, string[]>> = {};
  const flatByCategory: Record<string, string[]> = {};
  const virtualByCategory: Record<string, Record<string, string[]>> = {};

  for (const skill of skills) {
    const parts = skill.source.split('/');
    const category = parts[0];
    const groupId = parts.length > 1 ? parts.slice(1).join('/') : undefined;

    if (groupId) {
      (byCategory[category] ??= {})[groupId] ??= [];
      byCategory[category][groupId].push(skill.name);
      continue;
    }

    const skillKey = `${skill.source}/${skill.name}`;
    const virtualGroups = skillToVirtualGroups.get(skillKey) ?? [];
    if (virtualGroups.length > 0) {
      for (const groupName of virtualGroups) {
        (virtualByCategory[category] ??= {})[groupName] ??= [];
        virtualByCategory[category][groupName].push(skill.name);
      }
      continue;
    }

    (flatByCategory[category] ??= []).push(skill.name);
  }

  return renderCategories(
    byCategory,
    virtualByCategory,
    flatByCategory,
    skillToCollections,
  );
}

function distinctCategoryCount(
  physical: Record<string, string[]>,
  virtual: Record<string, string[]>,
  flat: string[],
): number {
  const names = new Set<string>(flat);
  for (const skillNames of Object.values(physical)) {
    for (const name of skillNames) names.add(name);
  }
  for (const skillNames of Object.values(virtual)) {
    for (const name of skillNames) names.add(name);
  }
  return names.size;
}

function renderNameLine(
  name: string,
  sourcePrefix: string,
  skillToCollections: Map<string, string[]>,
): string {
  const collections =
    skillToCollections.get(sourcePrefix) ??
    skillToCollections.get(`${sourcePrefix}/${name}`);
  if (!collections || collections.length === 0) return name;
  return `${name}  ← ${collections.join(', ')}`;
}

function renderCategories(
  byCategory: Record<string, Record<string, string[]>>,
  virtualByCategory: Record<string, Record<string, string[]>>,
  flatByCategory: Record<string, string[]>,
  skillToCollections: Map<string, string[]>,
): string[] {
  const allCategories = new Set([
    ...Object.keys(byCategory),
    ...Object.keys(virtualByCategory),
    ...Object.keys(flatByCategory),
  ]);

  const lines: string[] = [];
  for (const category of allCategories) {
    const physical = byCategory[category] || {};
    const virtual = virtualByCategory[category] || {};
    const flat = flatByCategory[category] || [];
    const total = distinctCategoryCount(physical, virtual, flat);

    lines.push(`── ${category} (${total} skill${total > 1 ? 's' : ''}) ──`);

    for (const groupId of Object.keys(physical).sort((a, b) => a.localeCompare(b))) {
      const skillNames = physical[groupId];
      lines.push(`  ${groupId} (${skillNames.length})`);
      const sourcePrefix = `${category}/${groupId}`;
      for (const name of skillNames) {
        lines.push(`    ${renderNameLine(name, sourcePrefix, skillToCollections)}`);
      }
    }

    for (const groupName of Object.keys(virtual).sort((a, b) => a.localeCompare(b))) {
      const skillNames = virtual[groupName];
      lines.push(`  ${groupName} (${skillNames.length})`);
      for (const name of skillNames) {
        lines.push(`    ${renderNameLine(name, category, skillToCollections)}`);
      }
    }

    for (const name of flat) {
      lines.push(`  ${renderNameLine(name, category, skillToCollections)}`);
    }

    lines.push('');
  }

  return lines;
}

export async function executeList(options: ListOptions): Promise<void> {
  if (options.deployed) {
    await listDeployed(options);
  } else {
    await listAvailable(options);
  }
}

async function listAvailable(options: ListOptions = {}): Promise<void> {
  await ensureSetup();

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const skills = skillsService.getAllSkills();

  const skillToCollections = buildSkillKeyToCollections();

  if (options.json) {
    const sourcesService = new SourcesService();
    const allSources = sourcesService.getAllSources();

    jsonOutput({
      skills: skills.map((s) => {
        const skillKey = `${s.source}/${s.name}`;
        const isCustom = s.source.startsWith('custom');
        const sourceInfo = allSources[s.source] ?? allSources[skillKey];
        const collections = skillToCollections.get(skillKey) ?? [];

        return {
          name: s.name,
          source: s.source,
          category: s.source.split('/')[0],
          path: s.path,
          url: sourceInfo?.url ?? null,
          installMethod:
            sourceInfo?.installMethod ?? (isCustom ? 'local-copy' : null),
          collections,
        };
      }),
    });
    return;
  }

  if (skills.length === 0) {
    console.log('No skills found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropics/skills');
    return;
  }

  console.log('Available in ~/.skills-manager/:\n');

  const skillToVirtualGroups = buildSkillKeyToVirtualGroups();
  const bodyLines = renderAvailableBody(
    skills,
    skillToCollections,
    skillToVirtualGroups,
  );
  for (const line of bodyLines) {
    console.log(line);
  }

  // Show explicit collection summary at the end
  const collectionGroups = new GroupsService()
    .listGroups()
    .map((n) => new GroupsService().getGroup(n))
    .filter((g): g is Extract<NonNullable<ReturnType<GroupsService['getGroup']>>, { kind: 'collection' }> =>
      g != null && g.kind === 'collection',
    );
  if (collectionGroups.length > 0) {
    console.log('── collections ──');
    for (const c of collectionGroups) {
      console.log(`  ${c.ref} (${c.members.length})`);
    }
    console.log();
  }
}

async function listDeployed(options: ListOptions = {}): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const skills = scanner.getDeployedSkills();

  if (options.json) {
    jsonOutput({
      skills: skills.map((s) => ({
        name: s.name,
        source: s.source,
        deployMode: s.deployMode,
        conflict: s.conflict ?? false,
      })),
    });
    return;
  }

  if (skills.length === 0) {
    console.log('No skills deployed in current project.');
    console.log('\nRun: skillsmgr deploy');
    return;
  }

  console.log('Deployed in current project (.agents/skills/):\n');

  for (const skill of skills) {
    const modeStr = skill.deployMode === 'link' ? 'link' : 'copy';
    if (skill.conflict) {
      console.log(`  ⚠ ${skill.name.padEnd(16)} (${modeStr}) ← conflict`);
    } else {
      console.log(`  ◉ ${skill.name.padEnd(16)} (${modeStr}) ← ${skill.source}`);
    }
  }

  console.log();

  // Show configured tools
  const configuredTools = scanner.getConfiguredTools();
  const nativeTools = configuredTools.filter((t) => TOOL_CONFIGS[t].native);
  const symlinkTools = configuredTools.filter((t) => !TOOL_CONFIGS[t].native);

  console.log('Configured agents:');

  if (nativeTools.length > 0) {
    const names = nativeTools.map((t) => TOOL_CONFIGS[t].displayName).join(', ');
    console.log(`  Agents Skills Standard → ${names}`);
  }

  for (const toolName of symlinkTools) {
    const config = TOOL_CONFIGS[toolName];
    console.log(`  ${config.displayName} (symlink: ${config.symlinkDir} → .agents/skills)`);
  }

  console.log();
}

export const listCommand = new Command('list')
  .description('List available or deployed skills')
  .option('--deployed', 'List deployed skills in current project')
  .option('--json', 'Output as JSON')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

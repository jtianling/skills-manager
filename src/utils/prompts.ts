import inquirer from 'inquirer';
import * as readline from 'readline';
import { Writable } from 'stream';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { GroupsService } from '../services/groups.js';
import { SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS, ToolName } from '../constants.js';
import { interactiveCheckbox, SelectChoice } from './interactive-select.js';

/**
 * Handle Ctrl+C gracefully during prompts
 */
function handlePromptError(error: unknown): never {
  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'ExitPromptError') {
      console.log('\nCancelled.');
      process.exit(0);
    }
  }
  throw error;
}

const AGENTS_SKILLS_STANDARD_VALUE = 'agents-skills-standard';

export const DISPLAY_ORDER: ToolName[] = [
  'claude-code', 'codex', 'cursor', 'openclaw', 'opencode', 'gemini-cli',
  'github-copilot', 'cline', 'kilo', 'roo', 'kiro-cli', 'trae',
  'trae-cn', 'codebuddy', 'windsurf', 'goose',
];

function getListedTools(): ToolName[] {
  return DISPLAY_ORDER.filter((t) => TOOL_CONFIGS[t].showInList);
}

export async function promptAgents(configuredTools?: string[]): Promise<string[]> {
  const listedTools = getListedTools();
  const nativeListedTools = listedTools.filter((t) => TOOL_CONFIGS[t].native);
  const symlinkListedTools = listedTools.filter((t) => !TOOL_CONFIGS[t].native);

  const nativeNames = nativeListedTools.map((t) => TOOL_CONFIGS[t].displayName).join(', ');
  const hasNativeConfigured = configuredTools?.some((t) => TOOL_CONFIGS[t as ToolName]?.native);
  const hasSymlinkConfigured = configuredTools?.some((t) => !TOOL_CONFIGS[t as ToolName]?.native);

  const choices = [
    {
      name: `Agents Skills Standard → ${nativeNames}`,
      value: AGENTS_SKILLS_STANDARD_VALUE,
      checked: (hasNativeConfigured || hasSymlinkConfigured) ?? false,
      suffix: hasNativeConfigured ? '[configured]' : undefined,
    },
    ...symlinkListedTools.map((tool) => {
      const config = TOOL_CONFIGS[tool];
      const isConfigured = configuredTools?.includes(tool);
      return {
        name: isConfigured ? `${config.displayName} [configured]` : config.displayName,
        value: tool,
        checked: isConfigured ?? false,
        suffix: isConfigured ? '[configured]' : undefined,
        selectedSuffix: '(Symlink to Agents Skills)',
      };
    }),
  ];

  const agentsIndex = 0;

  return interactiveCheckbox({
    message: 'Select target agents:',
    choices,
    onToggle(selected) {
      const hasAnySymlink = symlinkListedTools.some((_, i) => selected.has(i + 1));
      if (hasAnySymlink && !selected.has(agentsIndex)) {
        selected.add(agentsIndex);
      }
    },
  });
}

export async function promptAgentsGlobal(): Promise<string[]> {
  const listedTools = getListedTools();

  const choices = listedTools.map((tool) => {
    const config = TOOL_CONFIGS[tool];
    return {
      name: config.displayName,
      value: tool,
      checked: false,
    };
  });

  return interactiveCheckbox({
    message: 'Select target agents for global install:',
    choices,
    pageSize: 16,
  });
}

export function getSourceSuffix(source: string): string | undefined {
  if (source.startsWith('custom')) return undefined;
  const parts = source.split('/');
  if (parts.length < 2) return undefined;
  return `(${parts.slice(1).join('/')})`;
}

export function mergeSuffix(...parts: (string | undefined)[]): string | undefined {
  const filtered = parts.filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(' ') : undefined;
}

function parseSource(source: string): { category: string; groupId?: string } {
  const parts = source.split('/');
  const category = parts[0];
  if (parts.length === 1) return { category };
  return { category, groupId: parts.slice(1).join('/') };
}

function buildSkillChoices(
  skills: SkillInfo[],
  mapChoice: (
    skill: SkillInfo,
    category: string,
    groupId?: string
  ) => {
    name: string;
    description: string;
    value: string;
    checked?: boolean;
    group?: string;
    subGroup?: string;
    suffix?: string;
  }
): Array<{
  name: string;
  description: string;
  value: string;
  checked?: boolean;
  group?: string;
  subGroup?: string;
  suffix?: string;
}> {
  const grouped: Record<string, SkillInfo[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  const choices: Array<{
    name: string;
    description: string;
    value: string;
    checked?: boolean;
    group?: string;
    subGroup?: string;
    suffix?: string;
  }> = [];

  const entries = Object.entries(grouped).sort(([a], [b]) => {
    const { category: catA, groupId: gidA } = parseSource(a);
    const { category: catB, groupId: gidB } = parseSource(b);
    if (catA !== catB) return catA.localeCompare(catB);
    if (!gidA && gidB) return 1;
    if (gidA && !gidB) return -1;
    return a.localeCompare(b);
  });

  for (const [source, sourceSkills] of entries) {
    const { category, groupId } = parseSource(source);
    const effectiveGroupId = groupId;
    for (const skill of sourceSkills) {
      choices.push(mapChoice(skill, category, effectiveGroupId));
    }
  }

  return choices;
}

export type VirtualGroupsData = Record<string, string[]>;

export interface BuildVirtualGroupChoicesOptions<
  T extends { name: string; source: string; description?: string },
> {
  getValue?: (skill: T) => string;
  getDescription?: (skill: T) => string | undefined;
  getChecked?: (skill: T) => boolean | undefined;
  getSuffix?: (skill: T) => string | undefined;
  getLocked?: (skill: T) => boolean | undefined;
}

export function loadGroupsData(groupsService: GroupsService): VirtualGroupsData {
  return groupsService.listGroups().reduce<VirtualGroupsData>((acc, groupName) => {
    const skillKeys = groupsService.getGroup(groupName);
    if (!skillKeys) {
      return acc;
    }

    return {
      ...acc,
      [groupName]: skillKeys,
    };
  }, {});
}

export function buildVirtualGroupChoices<
  T extends { name: string; source: string; description?: string },
>(
  skills: T[],
  groupsData: VirtualGroupsData = {},
  options: BuildVirtualGroupChoicesOptions<T> = {},
): SelectChoice[] {
  const groupNames = Object.keys(groupsData).sort((a, b) => a.localeCompare(b));
  const skillToGroup = new Map<string, string>();

  for (const groupName of groupNames) {
    const skillKeys = groupsData[groupName] ?? [];
    for (const skillKey of skillKeys) {
      if (!skillToGroup.has(skillKey)) {
        skillToGroup.set(skillKey, groupName);
      }
    }
  }

  const groupedSkills = new Map<string, T[]>();
  const ungroupedSkills: T[] = [];
  let hasNamedGroup = false;

  for (const skill of skills) {
    const skillKey = `${skill.source}/${skill.name}`;
    const groupName = skillToGroup.get(skillKey);

    if (groupName) {
      hasNamedGroup = true;
      const existing = groupedSkills.get(groupName) ?? [];
      groupedSkills.set(groupName, [...existing, skill]);
      continue;
    }

    ungroupedSkills.push(skill);
  }

  const toChoice = (skill: T, subGroup?: string): SelectChoice => ({
    name: skill.name,
    description: options.getDescription?.(skill) ?? skill.description,
    value: options.getValue?.(skill) ?? skill.name,
    checked: options.getChecked?.(skill),
    suffix: mergeSuffix(
      subGroup !== undefined ? getSourceSuffix(skill.source) : undefined,
      options.getSuffix?.(skill),
    ),
    locked: options.getLocked?.(skill),
    subGroup,
  });

  if (!hasNamedGroup) {
    return skills.map((skill) => toChoice(skill));
  }

  const orderedGroups = Array.from(groupedSkills.keys()).sort((a, b) => a.localeCompare(b));
  const choices: SelectChoice[] = [];

  for (const groupName of orderedGroups) {
    const groupSkills = groupedSkills.get(groupName) ?? [];
    choices.push(...groupSkills.map((skill) => toChoice(skill, groupName)));
  }

  if (ungroupedSkills.length > 0) {
    choices.push(...ungroupedSkills.map((skill) => toChoice(skill)));
  }

  return choices;
}

const CATEGORY_ORDER: Record<string, number> = { official: 0, community: 1, custom: 2 };

export function buildSourceGroupedChoices<
  T extends { name: string; source: string; description?: string },
>(
  skills: T[],
  groupsData: VirtualGroupsData,
  options: {
    getValue?: (skill: T) => string;
    getChecked?: (skill: T) => boolean | undefined;
    getSuffix?: (skill: T) => string | undefined;
    getLocked?: (skill: T) => boolean | undefined;
  } = {},
): SelectChoice[] {
  const skillToGroup = new Map<string, string>();
  for (const [groupName, keys] of Object.entries(groupsData)) {
    for (const key of keys) {
      if (!skillToGroup.has(key)) skillToGroup.set(key, groupName);
    }
  }

  const movedToVirtualGroup = new Map<string, T[]>();
  const movedKeys = new Set<string>();

  const byCategory = new Map<string, T[]>();
  for (const skill of skills) {
    const skillKey = `${skill.source}/${skill.name}`;
    const { category } = parseSource(skill.source);
    const vg = skillToGroup.get(skillKey);

    if (vg && category !== 'custom') {
      movedToVirtualGroup.set(vg, [...(movedToVirtualGroup.get(vg) ?? []), skill]);
      movedKeys.add(skillKey);
    } else {
      byCategory.set(category, [...(byCategory.get(category) ?? []), skill]);
    }
  }

  const hasMovedSkills = movedKeys.size > 0;
  if (hasMovedSkills && !byCategory.has('custom')) {
    byCategory.set('custom', []);
  }

  const categories = Array.from(byCategory.keys()).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
  );
  const showCategory = categories.length > 1;

  const toChoice = (
    skill: T,
    group?: string,
    subGroup?: string,
    sourceSuffix?: string,
  ): SelectChoice => ({
    name: skill.name,
    description: skill.description,
    value: options.getValue?.(skill) ?? skill.name,
    checked: options.getChecked?.(skill),
    suffix: mergeSuffix(sourceSuffix, options.getSuffix?.(skill)),
    locked: options.getLocked?.(skill),
    group,
    subGroup,
  });

  const choices: SelectChoice[] = [];

  for (const category of categories) {
    const catSkills = byCategory.get(category)!;
    const group = showCategory ? category : undefined;

    if (category === 'custom') {
      const grouped = new Map<string, T[]>();
      const ungrouped: T[] = [];
      let hasNamed = false;

      for (const skill of catSkills) {
        const vg = skillToGroup.get(`${skill.source}/${skill.name}`);
        if (vg) {
          hasNamed = true;
          grouped.set(vg, [...(grouped.get(vg) ?? []), skill]);
        } else {
          ungrouped.push(skill);
        }
      }

      for (const [vgName, vgSkills] of movedToVirtualGroup) {
        hasNamed = true;
        grouped.set(vgName, [...(grouped.get(vgName) ?? []), ...vgSkills]);
      }

      if (hasNamed) {
        for (const gn of Array.from(grouped.keys()).sort()) {
          choices.push(...grouped.get(gn)!.map(s =>
            toChoice(s, group, gn, getSourceSuffix(s.source))
          ));
        }
        if (ungrouped.length > 0) {
          choices.push(...ungrouped.map(s => toChoice(s, group)));
        }
      } else {
        choices.push(...catSkills.map(s => toChoice(s, group)));
      }
    } else {
      const bySource = new Map<string, T[]>();
      for (const skill of catSkills) {
        const { groupId } = parseSource(skill.source);
        const key = groupId ?? skill.source;
        bySource.set(key, [...(bySource.get(key) ?? []), skill]);
      }

      for (const src of Array.from(bySource.keys()).sort()) {
        const srcSkills = bySource.get(src)!;
        if (srcSkills.length > 0) {
          choices.push(...srcSkills.map(s => toChoice(s, group, src)));
        }
      }
    }
  }

  return choices;
}

export async function promptSkills(
  skills: SkillInfo[],
  deployedSkillNames: string[] = [],
  groupsData?: VirtualGroupsData,
): Promise<string[]> {
  const choices = buildSourceGroupedChoices(skills, groupsData ?? {}, {
    getChecked: (skill) => deployedSkillNames.includes(skill.name) ? true : undefined,
    getSuffix: (skill) => deployedSkillNames.includes(skill.name) ? '[deployed]' : undefined,
  });

  return interactiveCheckbox({
    message: 'Select skills to deploy:',
    choices,
    pageSize: 15,
  });
}

export async function promptSkillsToUninstall(
  skills: SkillInfo[],
  groupsData?: VirtualGroupsData,
): Promise<string[]> {
  const choices = buildSourceGroupedChoices(skills, groupsData ?? {}, {
    getValue: (skill) => skill.path,
  });

  return interactiveCheckbox({
    message: 'Select skills to uninstall:',
    choices,
    pageSize: 15,
  });
}

export async function promptSkillsToInstall(
  skills: Array<{ name: string; description: string }>,
  installedNames?: Set<string>,
): Promise<string[]> {
  const choices = skills.map((skill) => {
    const isInstalled = installedNames?.has(skill.name) ?? false;
    return {
      name: skill.name,
      description: skill.description,
      value: skill.name,
      checked: isInstalled,
      locked: isInstalled,
      suffix: isInstalled ? ' (installed)' : undefined,
    };
  });

  const selected = await interactiveCheckbox({
    message: 'Select skills to install:',
    choices,
    pageSize: 15,
  });

  return selected.filter((name) => !installedNames?.has(name));
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);

    return confirmed;
  } catch (error) {
    handlePromptError(error);
  }
}

export async function promptSelect<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  return new Promise((resolve) => {
    let cursor = 0;
    let lastLines = 0;

    const nullOutput = new Writable({ write(_chunk, _encoding, cb) { cb(); } });
    const rl = readline.createInterface({ input: process.stdin, output: nullOutput });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, rl);

    const render = (initial = false) => {
      if (!initial && lastLines > 0) {
        process.stdout.write(`\x1b[${lastLines}A\x1b[J`);
      }
      const lines: string[] = [`? ${message}`];
      choices.forEach((c, i) => {
        const prefix = i === cursor ? '\x1b[36m❯\x1b[0m' : ' ';
        const highlight = i === cursor ? '\x1b[36m' : '';
        const reset = '\x1b[0m';
        lines.push(`  ${prefix} ${highlight}${c.name}${reset}`);
      });
      lines.push('\x1b[2m(↑↓ move, enter select, q quit)\x1b[0m');
      console.log(lines.join('\n'));
      lastLines = lines.length;
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKey);
      rl.close();
    };

    const onKey = (_str: string | undefined, key: readline.Key) => {
      if (!key) return;
      if (key.name === 'c' && key.ctrl) {
        cleanup();
        console.log('\nCancelled.');
        process.exit(0);
      }
      if (key.name === 'q') {
        cleanup();
        console.log('\nCancelled.');
        process.exit(0);
      }
      if (key.name === 'up' || key.name === 'k') {
        cursor = cursor > 0 ? cursor - 1 : choices.length - 1;
        render();
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        cursor = cursor < choices.length - 1 ? cursor + 1 : 0;
        render();
        return;
      }
      if (key.name === 'return') {
        cleanup();
        process.stdout.write(`\x1b[${lastLines}A\x1b[J`);
        console.log(`? ${message} \x1b[36m${choices[cursor].name}\x1b[0m`);
        resolve(choices[cursor].value);
      }
    };

    render(true);
    process.stdin.on('keypress', onKey);
  });
}

export interface ResolveAgentsOptions {
  agent?: string[];
  sameAgents?: boolean;
}

export async function resolveTargetAgents(
  options: ResolveAgentsOptions,
  getConfiguredTools: () => ToolName[],
  global?: boolean,
): Promise<ToolName[]> {
  if (options.agent && options.agent.length > 0 && options.sameAgents) {
    console.log('Cannot use --agent and --same-agents together.');
    process.exit(1);
  }

  if (options.agent && options.agent.length > 0) {
    for (const agent of options.agent) {
      if (!SUPPORTED_TOOLS.includes(agent as ToolName)) {
        console.log(`Unknown agent: '${agent}'. Available agents: ${SUPPORTED_TOOLS.join(', ')}`);
        process.exit(1);
      }
    }
    return options.agent as ToolName[];
  }

  if (options.sameAgents) {
    const configured = getConfiguredTools();
    if (configured.length === 0) {
      console.log('No agents configured. Run \'skillsmgr deploy\' or omit --same-agents flag.');
      process.exit(1);
    }
    return configured;
  }

  if (global) {
    return promptAgentsGlobal() as Promise<ToolName[]>;
  }

  return promptAgents(getConfiguredTools()) as Promise<ToolName[]>;
}

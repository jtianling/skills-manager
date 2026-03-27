import inquirer from 'inquirer';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS, ToolName } from '../constants.js';
import { interactiveCheckbox } from './interactive-select.js';

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

export async function promptAgents(configuredTools?: string[]): Promise<string[]> {
  const nativeTools = SUPPORTED_TOOLS.filter((t) => TOOL_CONFIGS[t].native);
  const symlinkTools = SUPPORTED_TOOLS.filter((t) => !TOOL_CONFIGS[t].native);

  const nativeNames = nativeTools.map((t) => TOOL_CONFIGS[t].displayName).join(', ');
  const hasNativeConfigured = configuredTools?.some((t) => TOOL_CONFIGS[t as keyof typeof TOOL_CONFIGS]?.native);
  const hasSymlinkConfigured = configuredTools?.some((t) => !TOOL_CONFIGS[t as keyof typeof TOOL_CONFIGS]?.native);

  const choices = [
    {
      name: `Agents Skills Standard → ${nativeNames}`,
      value: AGENTS_SKILLS_STANDARD_VALUE,
      checked: (hasNativeConfigured || hasSymlinkConfigured) ?? false,
      suffix: hasNativeConfigured ? '[configured]' : undefined,
    },
    ...symlinkTools.map((tool) => {
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
      const hasAnySymlink = symlinkTools.some((_, i) => selected.has(i + 1));
      if (hasAnySymlink && !selected.has(agentsIndex)) {
        selected.add(agentsIndex);
      }
    },
  });
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

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    const { category, groupId } = parseSource(source);
    for (const skill of sourceSkills) {
      choices.push(mapChoice(skill, category, groupId));
    }
  }

  return choices;
}

export async function promptSkills(
  skills: SkillInfo[],
  deployedSkillNames: string[] = []
): Promise<string[]> {
  const choices = buildSkillChoices(
    skills,
    (skill, category, groupId) => {
      const isDeployed = deployedSkillNames.includes(skill.name);
      return {
        name: skill.name,
        description: skill.description,
        value: skill.name,
        checked: isDeployed,
        group: category,
        subGroup: groupId,
        suffix: isDeployed ? '[deployed]' : undefined,
      };
    }
  );

  return interactiveCheckbox({
    message: 'Select skills to deploy:',
    choices,
    pageSize: 15,
  });
}

export async function promptSkillsToUninstall(skills: SkillInfo[]): Promise<string[]> {
  const choices = buildSkillChoices(
    skills,
    (skill, category, groupId) => ({
      name: skill.name,
      description: skill.description,
      value: skill.path,
      checked: false,
      group: category,
      subGroup: groupId,
    })
  );

  return interactiveCheckbox({
    message: 'Select skills to uninstall:',
    choices,
    pageSize: 15,
  });
}

export async function promptSkillsToInstall(
  skills: Array<{ name: string; description: string }>
): Promise<string[]> {
  const choices = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    value: skill.name,
  }));

  return interactiveCheckbox({
    message: 'Select skills to install:',
    choices,
    pageSize: 15,
  });
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
  try {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message,
        choices,
      },
    ]);

    return selected;
  } catch (error) {
    handlePromptError(error);
  }
}

export async function promptSyncAction(
  filename: string,
  showDiff: boolean = true
): Promise<'overwrite' | 'skip' | 'diff'> {
  const choices = [
    { name: 'Overwrite', value: 'overwrite' },
    { name: 'Skip', value: 'skip' },
    ...(showDiff ? [{ name: 'Show diff', value: 'diff' }] : []),
  ];

  try {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${filename}: source changed`,
        choices,
      },
    ]);

    return action;
  } catch (error) {
    handlePromptError(error);
  }
}

export async function promptOrphanAction(
  skillName: string
): Promise<'remove' | 'keep'> {
  try {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${skillName}: source no longer exists`,
        choices: [
          { name: 'Remove', value: 'remove' },
          { name: 'Keep', value: 'keep' },
        ],
      },
    ]);

    return action;
  } catch (error) {
    handlePromptError(error);
  }
}

export interface ResolveAgentsOptions {
  agent?: string[];
  sameAgents?: boolean;
}

export async function resolveTargetAgents(
  options: ResolveAgentsOptions,
  getConfiguredTools: () => ToolName[],
): Promise<string[]> {
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
    return options.agent;
  }

  if (options.sameAgents) {
    const configured = getConfiguredTools();
    if (configured.length === 0) {
      console.log('No agents configured. Run \'skillsmgr init\' or omit --same-agents flag.');
      process.exit(1);
    }
    return configured;
  }

  return promptAgents(getConfiguredTools());
}

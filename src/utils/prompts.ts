import inquirer from 'inquirer';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS } from '../constants.js';
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

export async function promptTools(configuredTools?: string[]): Promise<string[]> {
  const nativeTools = SUPPORTED_TOOLS.filter((t) => TOOL_CONFIGS[t].native);
  const symlinkTools = SUPPORTED_TOOLS.filter((t) => !TOOL_CONFIGS[t].native);

  const nativeNames = nativeTools.map((t) => TOOL_CONFIGS[t].displayName).join(', ');
  const hasNativeConfigured = configuredTools?.some((t) => TOOL_CONFIGS[t as keyof typeof TOOL_CONFIGS]?.native);

  const choices = [
    {
      name: `Agents Skills Standard → ${nativeNames}`,
      value: AGENTS_SKILLS_STANDARD_VALUE,
      checked: hasNativeConfigured ?? false,
      suffix: hasNativeConfigured ? '[configured]' : undefined,
    },
    ...symlinkTools.map((tool) => {
      const config = TOOL_CONFIGS[tool];
      const isConfigured = configuredTools?.includes(tool);
      return {
        name: isConfigured
          ? `${config.displayName} (symlink: ${config.symlinkDir} → .agents/skills) [configured]`
          : `${config.displayName} (symlink: ${config.symlinkDir} → .agents/skills)`,
        value: tool,
        checked: isConfigured ?? false,
        suffix: isConfigured ? '[configured]' : undefined,
      };
    }),
  ];

  return interactiveCheckbox({
    message: 'Select target tools:',
    choices,
  });
}

export async function promptSkills(
  skills: SkillInfo[],
  deployedSkillNames: string[] = []
): Promise<string[]> {
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
    suffix?: string;
  }> = [];

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    for (const skill of sourceSkills) {
      const isDeployed = deployedSkillNames.includes(skill.name);
      choices.push({
        name: skill.name,
        description: skill.description,
        value: skill.name,
        checked: isDeployed,
        group: source,
        suffix: isDeployed ? '[deployed]' : undefined,
      });
    }
  }

  return interactiveCheckbox({
    message: 'Select skills to deploy:',
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

export async function promptConfirm(message: string): Promise<boolean> {
  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: true,
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

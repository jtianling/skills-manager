import inquirer from 'inquirer';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ToolName, SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS } from '../constants.js';

export async function promptTools(configuredTools?: string[]): Promise<string[]> {
  const choices = SUPPORTED_TOOLS.map((tool) => {
    const config = TOOL_CONFIGS[tool];
    const isConfigured = configuredTools?.includes(tool);
    return {
      name: isConfigured ? `${config.displayName} [configured]` : config.displayName,
      value: tool,
      checked: isConfigured,
    };
  });

  const { tools } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Select target tools:',
      choices,
      validate: (answer: string[]) => {
        if (answer.length === 0) {
          return 'You must select at least one tool.';
        }
        return true;
      },
    },
  ]);

  return tools;
}

export async function promptMode(toolName: string, modes: string[]): Promise<string> {
  const config = TOOL_CONFIGS[toolName as ToolName];
  const choices = [
    { name: `All modes (${config.skillsDir}/)`, value: 'all' },
    ...modes.map((mode) => ({
      name: `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode only (${config.skillsDir.replace('skills', `skills-${mode}`)}/)`,
      value: mode,
    })),
  ];

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: `Select target mode for ${config.displayName}:`,
      choices,
    },
  ]);

  return mode;
}

export async function promptSkills(
  skills: SkillInfo[],
  deployedSkillNames: string[] = []
): Promise<string[]> {
  // Group skills by source
  const grouped: Record<string, SkillInfo[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  const choices: Array<{ name: string; value: string; checked?: boolean } | inquirer.Separator> = [];

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    choices.push(new inquirer.Separator(`── ${source} ──`));
    for (const skill of sourceSkills) {
      const isDeployed = deployedSkillNames.includes(skill.name);
      choices.push({
        name: isDeployed
          ? `${skill.name.padEnd(20)} [deployed]  ${skill.description}`
          : `${skill.name.padEnd(20)} ${skill.description}`,
        value: skill.name,
        checked: isDeployed,
      });
    }
  }

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Select skills to deploy:',
      choices,
      pageSize: 20,
    },
  ]);

  return selectedSkills;
}

export async function promptSkillsToInstall(
  skills: Array<{ name: string; description: string }>
): Promise<string[]> {
  const choices = skills.map((skill) => ({
    name: `${skill.name.padEnd(20)} ${skill.description}`,
    value: skill.name,
  }));

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Select skills to install:',
      choices,
      pageSize: 20,
    },
  ]);

  return selectedSkills;
}

export async function promptConfirm(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true,
    },
  ]);

  return confirmed;
}

export async function promptSelect<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);

  return selected;
}

export async function promptSyncAction(
  filename: string
): Promise<'overwrite' | 'skip' | 'diff'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `${filename}: source changed`,
      choices: [
        { name: 'Overwrite', value: 'overwrite' },
        { name: 'Skip', value: 'skip' },
        { name: 'Show diff', value: 'diff' },
      ],
    },
  ]);

  return action;
}

export async function promptOrphanAction(
  skillName: string
): Promise<'remove' | 'keep'> {
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
}

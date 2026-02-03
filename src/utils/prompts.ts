import inquirer from 'inquirer';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ToolName, SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS } from '../constants.js';

/**
 * Handle Ctrl+C gracefully during prompts
 */
function handlePromptError(error: unknown): never {
  // Check if it's an ExitPromptError (user pressed Ctrl+C)
  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'ExitPromptError') {
      console.log('\nCancelled.');
      process.exit(0);
    }
  }
  throw error;
}

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

  try {
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
  } catch (error) {
    handlePromptError(error);
  }
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

  try {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: `Select target mode for ${config.displayName}:`,
        choices,
      },
    ]);

    return mode;
  } catch (error) {
    handlePromptError(error);
  }
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

  try {
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
  } catch (error) {
    handlePromptError(error);
  }
}

export async function promptSkillsToInstall(
  skills: Array<{ name: string; description: string }>
): Promise<string[]> {
  const choices = skills.map((skill) => ({
    name: `${skill.name.padEnd(20)} ${skill.description}`,
    value: skill.name,
  }));

  try {
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
  } catch (error) {
    handlePromptError(error);
  }
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
  filename: string
): Promise<'overwrite' | 'skip' | 'diff'> {
  try {
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

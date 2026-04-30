import { existsSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { validatePackageName } from '../services/manifest.js';
import { readAuth } from '../services/auth.js';
import { handlePromptError } from '../utils/prompts.js';
import type { SkillManifest } from '../types.js';

export async function executeInit(options: { yes?: boolean; dir?: string }): Promise<void> {
  const targetDir = options.dir ?? process.cwd();
  const manifestPath = join(targetDir, 'skill.json');

  if (existsSync(manifestPath)) {
    console.log('skill.json already exists.');
    process.exit(1);
  }

  const dirName = basename(targetDir).toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const author = readAuth()?.username ?? '';

  if (options.yes) {
    const manifest: SkillManifest = {
      name: dirName,
      version: '1.0.0',
      description: '',
      license: 'MIT',
    };
    if (author) manifest.author = author;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log('Created skill.json');
    return;
  }

  let answers;
  try {
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package name:',
        default: dirName,
        validate: (input: string) => {
          const result = validatePackageName(input);
          return result.valid || result.error!;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        validate: (input: string) => input.trim().length > 0 || 'Description is required',
      },
      {
        type: 'input',
        name: 'dependencies',
        message: 'Dependencies (optional, comma-separated):',
      },
    ]);
  } catch (error) {
    handlePromptError(error);
  }

  const manifest: SkillManifest = {
    name: answers.name,
    version: '1.0.0',
    description: answers.description,
    license: 'MIT',
  };

  if (author) manifest.author = author;

  const deps = (answers.dependencies as string)
    .split(',')
    .map((d: string) => d.trim())
    .filter(Boolean);
  if (deps.length > 0) manifest.dependencies = deps;

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Created skill.json');
}

export const initCommand = new Command('init')
  .description(
    'Create a skill.json manifest interactively. ' +
      'Optional fields targetAgents / companions are not prompted; add them ' +
      'manually after init. See README "Target Agents" and "Companions" sections.',
  )
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options: { yes?: boolean }) => {
    await executeInit(options);
  });

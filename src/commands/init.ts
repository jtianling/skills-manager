import { existsSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { validatePackageName, validateManifest } from '../services/manifest.js';
import { handlePromptError } from '../utils/prompts.js';
import type { SkillManifest } from '../types.js';

export async function executeInit(options: { yes?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const manifestPath = join(cwd, 'skill.json');

  if (existsSync(manifestPath)) {
    console.log('skill.json already exists.');
    process.exit(1);
  }

  const dirName = basename(cwd).toLowerCase().replace(/[^a-z0-9._-]/g, '-');

  if (options.yes) {
    const manifest: SkillManifest = {
      name: dirName,
      version: '1.0.0',
      description: '',
    };
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
        name: 'version',
        message: 'Version:',
        default: '1.0.0',
        validate: (input: string) =>
          /^\d+\.\d+\.\d+/.test(input) || 'Must be valid semver (e.g., 1.0.0)',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
      },
      {
        type: 'input',
        name: 'license',
        message: 'License:',
        default: 'MIT',
      },
    ]);
  } catch (error) {
    handlePromptError(error);
  }

  const manifest: SkillManifest = {
    name: answers.name,
    version: answers.version,
    description: answers.description,
  };

  if (answers.author) manifest.author = answers.author;
  if (answers.license) manifest.license = answers.license;

  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    console.error(`Validation failed: ${errors.join(', ')}`);
    process.exit(1);
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Created skill.json');
}

export const initCommand = new Command('init')
  .description('Create a skill.json manifest interactively')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (options: { yes?: boolean }) => {
    await executeInit(options);
  });

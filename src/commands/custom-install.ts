import { Command } from 'commander';
import { basename, join, resolve } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, findScriptFiles, removeDir, warnScriptFiles } from '../utils/fs.js';
import { promptConfirm } from '../utils/prompts.js';

export const customInstallCommand = new Command('custom-install')
  .alias('ci')
  .description('Install a local skill to custom directory from name or path')
  .argument('<path>', 'Skill name or path (e.g., my-skill, ./my-skill, ~/workspace/my-skill)')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .option('-g, --group <name>', 'Group name for organizing custom skills')
  .action(async (path: string, options: { force?: boolean; group?: string }) => {
    if (!fileExists(SKILLS_MANAGER_DIR)) {
      console.log('Skills manager not set up. Run: skillsmgr setup');
      process.exit(1);
    }

    const skillDir = resolve(process.cwd(), path);
    const skillName = basename(skillDir);
    const skillMd = join(skillDir, 'SKILL.md');

    if (!fileExists(skillMd)) {
      console.error(`Error: Skill not found. Expected SKILL.md in ${skillDir}`);
      process.exit(1);
    }

    if (options.group && !/^[a-zA-Z0-9_-]+$/.test(options.group)) {
      console.error('Error: Group name must contain only letters, numbers, hyphens, and underscores');
      process.exit(1);
    }

    const targetDir = options.group
      ? join(SKILLS_MANAGER_DIR, 'custom', options.group, skillName)
      : join(SKILLS_MANAGER_DIR, 'custom', skillName);

    if (fileExists(targetDir) && !options.force) {
      const msg = options.group
        ? `Skill '${skillName}' already exists in group '${options.group}'. Overwrite?`
        : `Skill '${skillName}' already exists. Overwrite?`;
      const confirmed = await promptConfirm(msg);
      if (!confirmed) {
        console.log('Cancelled.');
        return;
      }
    }

    removeDir(targetDir);
    copyDir(skillDir, targetDir);
    warnScriptFiles(findScriptFiles(targetDir));

    console.log(`✓ Installed skill '${skillName}' to ${targetDir}`);
  });

import { Command } from 'commander';
import { join, resolve } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, removeDir } from '../utils/fs.js';
import { promptConfirm } from '../utils/prompts.js';

export const customInstallCommand = new Command('custom-install')
  .alias('ci')
  .description('Install a local skill to custom directory')
  .argument('<name>', 'Skill directory name in current working directory')
  .option('-f, --force', 'Overwrite existing skill without confirmation')
  .action(async (name: string, options: { force?: boolean }) => {
    if (!fileExists(SKILLS_MANAGER_DIR)) {
      console.log('Skills manager not set up. Run: skillsmgr setup');
      process.exit(1);
    }

    const skillDir = resolve(process.cwd(), name);
    const skillMd = join(skillDir, 'SKILL.md');

    if (!fileExists(skillMd)) {
      console.error(`Error: Skill not found. Expected ${name}/SKILL.md in current directory.`);
      process.exit(1);
    }

    const targetDir = join(SKILLS_MANAGER_DIR, 'custom', name);

    if (fileExists(targetDir) && !options.force) {
      const confirmed = await promptConfirm(`Skill '${name}' already exists. Overwrite?`);
      if (!confirmed) {
        console.log('Cancelled.');
        return;
      }
    }

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    console.log(`✓ Installed skill '${name}' to ${targetDir}`);
  });

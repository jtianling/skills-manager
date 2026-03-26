import { Command } from 'commander';
import { join, resolve } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, removeDir } from '../utils/fs.js';

export const customUpdateCommand = new Command('custom-update')
  .alias('cu')
  .description('Update an already-installed custom skill from current directory')
  .argument('<name>', 'Skill directory name in current working directory')
  .action(async (name: string) => {
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

    if (!fileExists(targetDir)) {
      console.error(`Error: Skill '${name}' is not installed. Run: skillsmgr custom-install ${name}`);
      process.exit(1);
    }

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    console.log(`✓ Updated skill '${name}' in ${targetDir}`);
  });

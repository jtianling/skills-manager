import { Command } from 'commander';
import { basename, join, resolve } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { copyDir, fileExists, removeDir } from '../utils/fs.js';

export const customUpdateCommand = new Command('custom-update')
  .alias('cu')
  .description('Update an already-installed custom skill')
  .argument('<path>', 'Skill name or path (e.g., my-skill, ./my-skill, ~/workspace/my-skill)')
  .action(async (path: string) => {
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

    const targetDir = join(SKILLS_MANAGER_DIR, 'custom', skillName);

    if (!fileExists(targetDir)) {
      console.error(`Error: Skill '${skillName}' is not installed. Run: skillsmgr custom-install ${skillName}`);
      process.exit(1);
    }

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    console.log(`✓ Updated skill '${skillName}' in ${targetDir}`);
  });

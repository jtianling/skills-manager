import { join } from 'path';
import { SKILLS_MANAGER_DIR, SKILL_SOURCES } from '../constants.js';
import { ensureDir, fileExists } from '../utils/fs.js';

export async function executeSetup(): Promise<void> {
  console.log(`Creating ${SKILLS_MANAGER_DIR}...`);

  for (const source of SKILL_SOURCES) {
    const dir = join(SKILLS_MANAGER_DIR, source);
    ensureDir(dir);
    console.log(`✓ Created ${source}/`);
  }

  console.log('\nSetup complete!\n');
  console.log('Next steps:');
  console.log('  skillsmgr install anthropic    # Download official Anthropic skills');
  console.log('  skillsmgr list                 # View available skills');
  console.log('  skillsmgr deploy               # Deploy skills to your project');
}

export async function ensureSetup(): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    await executeSetup();
    console.log();
  }
}

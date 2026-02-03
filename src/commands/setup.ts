import { Command } from 'commander';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SKILLS_MANAGER_DIR, SKILL_SOURCES } from '../constants.js';
import { ensureDir, copyDir, fileExists } from '../utils/fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function executeSetup(): Promise<void> {
  console.log(`Creating ${SKILLS_MANAGER_DIR}...`);

  // Create source directories
  for (const source of SKILL_SOURCES) {
    const dir = join(SKILLS_MANAGER_DIR, source);
    ensureDir(dir);
    console.log(`✓ Created ${source}/`);
  }

  // Copy example skill template
  // After bundling, templates are in the same directory as index.js (dist/)
  const templateDir = join(__dirname, 'templates', 'example-skill');
  const targetDir = join(SKILLS_MANAGER_DIR, 'custom', 'example-skill');

  if (!fileExists(targetDir)) {
    copyDir(templateDir, targetDir);
    console.log('✓ Created custom/example-skill/SKILL.md');
  } else {
    console.log('· custom/example-skill already exists, skipping');
  }

  console.log('\nSetup complete!\n');
  console.log('Next steps:');
  console.log('  skillsmgr install anthropic    # Download official Anthropic skills');
  console.log('  skillsmgr list                 # View available skills');
  console.log('  skillsmgr init                 # Deploy skills to your project');
}

export const setupCommand = new Command('setup')
  .description('Initialize ~/.skills-manager/ directory structure')
  .action(async () => {
    await executeSetup();
  });

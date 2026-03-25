import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { DeploymentScanner } from '../services/scanner.js';
import { Deployer } from '../services/deployer.js';
import { SkillsService } from '../services/skills.js';
import { fileExists, isSymlink, readFileContent } from '../utils/fs.js';
import { promptSyncAction, promptOrphanAction } from '../utils/prompts.js';

export async function executeSync(): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const deployer = new Deployer(process.cwd());
  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);

  const deployedSkills = scanner.getDeployedSkills();

  if (deployedSkills.length === 0) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  console.log('Checking deployed skills (.agents/skills/)...\n');

  let updatedCount = 0;
  let removedCount = 0;

  for (const skill of deployedSkills) {
    if (skill.source === 'unknown' && !skill.conflict) {
      console.log(`  ~ ${skill.name} (unmanaged)`);
      continue;
    }

    if (skill.conflict) {
      console.log(`  ⚠ ${skill.name}: conflict (skipped)`);
      continue;
    }

    const deployedPath = skill.path;

    let sourcePath: string | null = null;
    if (skill.source !== 'unknown') {
      const sourceSkill = skillsService.getSkillByName(skill.name);
      if (sourceSkill) {
        sourcePath = sourceSkill.path;
      }
    }

    if (!sourcePath || !fileExists(sourcePath)) {
      console.log(`  ✗ ${skill.name}: orphaned (source not found)`);
      const action = await promptOrphanAction(skill.name);
      if (action === 'remove') {
        deployer.removeSkill(skill.name);
        console.log(`  ✓ Removed ${skill.name}`);
        removedCount++;
      }
      continue;
    }

    if (isSymlink(deployedPath)) {
      console.log(`  ✓ ${skill.name}: up to date (link)`);
      continue;
    }

    if (skill.deployMode === 'copy') {
      const sourceSkillMd = join(sourcePath, 'SKILL.md');
      const deployedSkillMd = join(deployedPath, 'SKILL.md');

      if (fileExists(sourceSkillMd) && fileExists(deployedSkillMd)) {
        const sourceContent = readFileContent(sourceSkillMd);
        const deployedContent = readFileContent(deployedSkillMd);

        if (sourceContent !== deployedContent) {
          console.log(`  ⚠ ${skill.name}: source changed (copy)`);
          const action = await promptSyncAction(skill.name);

          if (action === 'diff') {
            console.log('\n--- local');
            console.log(deployedContent.slice(0, 500));
            console.log('\n+++ source');
            console.log(sourceContent.slice(0, 500));
            console.log();

            const finalAction = await promptSyncAction(skill.name);
            if (finalAction === 'overwrite') {
              deployer.deploySkill(
                { name: skill.name, description: '', path: sourcePath, source: skill.source },
                'copy'
              );
              console.log(`  ✓ Updated ${skill.name}`);
              updatedCount++;
            }
          } else if (action === 'overwrite') {
            deployer.deploySkill(
              { name: skill.name, description: '', path: sourcePath, source: skill.source },
              'copy'
            );
            console.log(`  ✓ Updated ${skill.name}`);
            updatedCount++;
          }
        } else {
          console.log(`  ✓ ${skill.name}: up to date (copy)`);
        }
      }
    }
  }

  console.log(
    `\nSync complete: ${updatedCount} updated, ${removedCount} removed`
  );
}

export const syncCommand = new Command('sync')
  .description('Sync and verify deployed skills')
  .action(async () => {
    await executeSync();
  });

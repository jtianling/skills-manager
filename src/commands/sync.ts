import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ToolName } from '../types.js';
import { fileExists, isSymlink, readFileContent } from '../utils/fs.js';
import { promptSyncAction, promptOrphanAction } from '../utils/prompts.js';

export async function executeSync(): Promise<void> {
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  if (!metadataService.hasMetadata()) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  console.log('Checking deployed skills...\n');

  const configuredTools = metadataService.getConfiguredTools();
  let updatedCount = 0;
  let removedCount = 0;
  let untrackedCount = 0;

  for (const toolName of configuredTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    if (!deployment) continue;

    console.log(`${config.displayName} (${deployment.targetDir}/):`);

    for (const skill of deployment.skills) {
      const deployedPath = join(process.cwd(), deployment.targetDir, skill.name);
      const sourcePath = join(SKILLS_MANAGER_DIR, skill.source, skill.name);

      // Check if source still exists
      if (!fileExists(sourcePath)) {
        console.log(`  ✗ ${skill.name}: orphaned (source deleted)`);
        const action = await promptOrphanAction(skill.name);
        if (action === 'remove') {
          deployer.removeSkill(skill.name, config, deployment.mode);
          const remaining = deployment.skills.filter((s) => s.name !== skill.name);
          metadataService.updateDeployment(toolName, remaining);
          console.log(`  ✓ Removed ${skill.name}`);
          removedCount++;
        }
        continue;
      }

      // Check symlink status
      if (isSymlink(deployedPath)) {
        console.log(`  ✓ ${skill.name}: up to date (link)`);
        continue;
      }

      // For copied files, check if content changed
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
                  config,
                  'copy',
                  deployment.mode
                );
                console.log(`  ✓ Updated ${skill.name}`);
                updatedCount++;
              }
            } else if (action === 'overwrite') {
              deployer.deploySkill(
                { name: skill.name, description: '', path: sourcePath, source: skill.source },
                config,
                'copy',
                deployment.mode
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

    console.log();
  }

  console.log(
    `Sync complete: ${updatedCount} updated, ${removedCount} removed, ${untrackedCount} untracked`
  );
}

export const syncCommand = new Command('sync')
  .description('Sync and verify deployed skills')
  .action(async () => {
    await executeSync();
  });

import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ListOptions } from '../types.js';
import { ensureSetup } from './setup.js';
import { jsonOutput } from '../utils/json-output.js';

export async function executeList(options: ListOptions): Promise<void> {
  if (options.deployed) {
    await listDeployed(options);
  } else {
    await listAvailable(options);
  }
}

async function listAvailable(options: ListOptions = {}): Promise<void> {
  await ensureSetup();

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const skills = skillsService.getAllSkills();

  if (options.json) {
    jsonOutput({
      skills: skills.map((s) => ({
        name: s.name,
        source: s.source,
        category: s.source.split('/')[0],
        path: s.path,
      })),
    });
    return;
  }

  if (skills.length === 0) {
    console.log('No skills found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropics/skills');
    return;
  }

  console.log('Available in ~/.skills-manager/:\n');

  const byCategory: Record<string, Record<string, string[]>> = {};
  const ungroupedByCategory: Record<string, string[]> = {};

  for (const skill of skills) {
    const parts = skill.source.split('/');
    const category = parts[0];
    const groupId = parts.length > 1 ? parts.slice(1).join('/') : undefined;

    if (groupId) {
      if (!byCategory[category]) byCategory[category] = {};
      if (!byCategory[category][groupId]) byCategory[category][groupId] = [];
      byCategory[category][groupId].push(skill.name);
    } else {
      if (!ungroupedByCategory[category]) ungroupedByCategory[category] = [];
      ungroupedByCategory[category].push(skill.name);
    }
  }

  const allCategories = new Set([...Object.keys(byCategory), ...Object.keys(ungroupedByCategory)]);

  for (const category of allCategories) {
    const groups = byCategory[category] || {};
    const ungrouped = ungroupedByCategory[category] || [];
    const totalCount = Object.values(groups).reduce((sum, g) => sum + g.length, 0) + ungrouped.length;

    console.log(`── ${category} (${totalCount} skill${totalCount > 1 ? 's' : ''}) ──`);

    for (const [groupId, skillNames] of Object.entries(groups)) {
      console.log(`  ${groupId} (${skillNames.length})`);
      for (const name of skillNames) {
        console.log(`    ${name}`);
      }
    }

    if (ungrouped.length > 0) {
      for (const name of ungrouped) {
        console.log(`  ${name}`);
      }
    }

    console.log();
  }
}

async function listDeployed(options: ListOptions = {}): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const skills = scanner.getDeployedSkills();

  if (options.json) {
    jsonOutput({
      skills: skills.map((s) => ({
        name: s.name,
        source: s.source,
        deployMode: s.deployMode,
        conflict: s.conflict ?? false,
      })),
    });
    return;
  }

  if (skills.length === 0) {
    console.log('No skills deployed in current project.');
    console.log('\nRun: skillsmgr deploy');
    return;
  }

  console.log('Deployed in current project (.agents/skills/):\n');

  for (const skill of skills) {
    const modeStr = skill.deployMode === 'link' ? 'link' : 'copy';
    if (skill.conflict) {
      console.log(`  ⚠ ${skill.name.padEnd(16)} (${modeStr}) ← conflict`);
    } else {
      console.log(`  ◉ ${skill.name.padEnd(16)} (${modeStr}) ← ${skill.source}`);
    }
  }

  console.log();

  // Show configured tools
  const configuredTools = scanner.getConfiguredTools();
  const nativeTools = configuredTools.filter((t) => TOOL_CONFIGS[t].native);
  const symlinkTools = configuredTools.filter((t) => !TOOL_CONFIGS[t].native);

  console.log('Configured agents:');

  if (nativeTools.length > 0) {
    const names = nativeTools.map((t) => TOOL_CONFIGS[t].displayName).join(', ');
    console.log(`  Agents Skills Standard → ${names}`);
  }

  for (const toolName of symlinkTools) {
    const config = TOOL_CONFIGS[toolName];
    console.log(`  ${config.displayName} (symlink: ${config.symlinkDir} → .agents/skills)`);
  }

  console.log();
}

export const listCommand = new Command('list')
  .description('List available or deployed skills')
  .option('--deployed', 'List deployed skills in current project')
  .option('--json', 'Output as JSON')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

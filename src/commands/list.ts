import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { DeploymentScanner } from '../services/scanner.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ListOptions } from '../types.js';
import { fileExists } from '../utils/fs.js';

export async function executeList(options: ListOptions): Promise<void> {
  if (options.deployed) {
    await listDeployed();
  } else {
    await listAvailable();
  }
}

async function listAvailable(): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const skills = skillsService.getAllSkills();

  if (skills.length === 0) {
    console.log('No skills found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropic');
    return;
  }

  console.log('Available in ~/.skills-manager/:\n');

  const grouped: Record<string, typeof skills> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    console.log(`── ${source} (${sourceSkills.length} skill${sourceSkills.length > 1 ? 's' : ''}) ──`);
    for (const skill of sourceSkills) {
      console.log(`  ${skill.name}`);
    }
    console.log();
  }
}

async function listDeployed(): Promise<void> {
  const scanner = new DeploymentScanner(process.cwd(), SKILLS_MANAGER_DIR);
  const skills = scanner.getDeployedSkills();

  if (skills.length === 0) {
    console.log('No skills deployed in current project.');
    console.log('\nRun: skillsmgr init');
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

  console.log('Configured tools:');

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
  .action(async (options: ListOptions) => {
    await executeList(options);
  });

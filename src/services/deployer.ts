import { join, dirname } from 'path';
import { existsSync, lstatSync, rmSync, unlinkSync } from 'fs';
import { SkillInfo, ToolConfig, ToolName } from '../types.js';
import { ensureDir, linkDir, copyDir, isSymlink } from '../utils/fs.js';
import { AGENTS_SKILLS_DIR, TOOL_CONFIGS } from '../tools/configs.js';

function pathOrLinkExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

export class Deployer {
  constructor(private projectDir: string) {}

  deploySkill(skill: SkillInfo, mode: 'link' | 'copy'): void {
    const fullTargetDir = join(this.projectDir, AGENTS_SKILLS_DIR);
    ensureDir(fullTargetDir);

    const skillTargetPath = join(fullTargetDir, skill.name);

    if (mode === 'link') {
      linkDir(skill.path, skillTargetPath);
    } else {
      copyDir(skill.path, skillTargetPath);
    }
  }

  deploySkills(skills: SkillInfo[], mode: 'link' | 'copy'): void {
    for (const skill of skills) {
      this.deploySkill(skill, mode);
    }
  }

  removeSkill(skillName: string): void {
    const skillPath = join(this.projectDir, AGENTS_SKILLS_DIR, skillName);
    if (pathOrLinkExists(skillPath)) {
      rmSync(skillPath, { recursive: true, force: true });
    }
  }

  createSymlinkBridge(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);
    const targetPath = join(this.projectDir, AGENTS_SKILLS_DIR);

    ensureDir(targetPath);

    if (existsSync(symlinkPath)) {
      if (isSymlink(symlinkPath)) {
        unlinkSync(symlinkPath);
      } else if (lstatSync(symlinkPath).isDirectory()) {
        console.log(`  ⚠ ${config.symlinkDir} is a real directory, skipping symlink`);
        return false;
      }
    }

    ensureDir(dirname(symlinkPath));
    linkDir(targetPath, symlinkPath);
    return true;
  }

  removeSymlinkBridge(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);

    if (existsSync(symlinkPath) && isSymlink(symlinkPath)) {
      unlinkSync(symlinkPath);
      return true;
    }

    return false;
  }

  isSkillDeployed(skillName: string): boolean {
    const skillPath = join(this.projectDir, AGENTS_SKILLS_DIR, skillName);
    return existsSync(skillPath);
  }

  isSymlinkBridgeActive(config: ToolConfig): boolean {
    if (config.native || !config.symlinkDir) return false;

    const symlinkPath = join(this.projectDir, config.symlinkDir);
    return existsSync(symlinkPath) && isSymlink(symlinkPath);
  }

  deploySkillGlobal(
    skill: SkillInfo,
    agents: ToolName[],
    mode: 'link' | 'copy',
  ): void {
    const processed = new Set<string>();

    for (const agentName of agents) {
      const config = TOOL_CONFIGS[agentName];
      if (!config) continue;

      const targetDir = config.globalSkillsDir;
      const skillTargetPath = join(targetDir, skill.name);

      if (processed.has(skillTargetPath)) continue;
      processed.add(skillTargetPath);

      ensureDir(targetDir);

      if (existsSync(skillTargetPath)) {
        if (isSymlink(skillTargetPath)) {
          unlinkSync(skillTargetPath);
        } else if (lstatSync(skillTargetPath).isDirectory()) {
          console.log(`  ⚠ ${skillTargetPath} is a real directory, skipping`);
          continue;
        } else if (lstatSync(skillTargetPath).isFile()) {
          console.log(`  ⚠ ${skillTargetPath} is a file, skipping`);
          continue;
        }
      }

      if (mode === 'link') {
        linkDir(skill.path, skillTargetPath);
      } else {
        copyDir(skill.path, skillTargetPath);
      }
      console.log(`  ✓ ${skill.name} → ${skillTargetPath} (${mode === 'link' ? 'linked' : 'copied'})`);
    }
  }

  removeSkillGlobal(skillName: string, agents: ToolName[]): boolean {
    const processed = new Set<string>();
    let removed = false;

    for (const agentName of agents) {
      const config = TOOL_CONFIGS[agentName];
      if (!config) continue;

      const skillPath = join(config.globalSkillsDir, skillName);

      if (processed.has(skillPath)) continue;
      processed.add(skillPath);

      if (pathOrLinkExists(skillPath)) {
        rmSync(skillPath, { recursive: true, force: true });
        console.log(`  ✓ Removed ${skillName} from ${config.globalSkillsDir}`);
        removed = true;
      }
    }

    return removed;
  }
}

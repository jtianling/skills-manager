import { join, dirname } from 'path';
import { existsSync, lstatSync, rmSync, unlinkSync } from 'fs';
import { SkillInfo, ToolConfig } from '../types.js';
import { ensureDir, linkDir, copyDir, isSymlink } from '../utils/fs.js';
import { AGENTS_SKILLS_DIR } from '../tools/configs.js';

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
    if (existsSync(skillPath)) {
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
}

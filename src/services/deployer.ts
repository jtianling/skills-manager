import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { SkillInfo, ToolConfig } from '../types.js';
import { ensureDir, linkDir, copyDir } from '../utils/fs.js';
import { getTargetDir } from '../tools/configs.js';

export class Deployer {
  constructor(private projectDir: string) {}

  deploySkill(
    skill: SkillInfo,
    toolConfig: ToolConfig,
    mode: 'link' | 'copy',
    targetMode?: string
  ): void {
    const targetDir = getTargetDir(toolConfig, targetMode);
    const fullTargetDir = join(this.projectDir, targetDir);
    ensureDir(fullTargetDir);

    const skillTargetPath = join(fullTargetDir, skill.name);

    if (mode === 'link') {
      linkDir(skill.path, skillTargetPath);
    } else {
      copyDir(skill.path, skillTargetPath);
    }
  }

  deploySkills(
    skills: SkillInfo[],
    toolConfig: ToolConfig,
    mode: 'link' | 'copy',
    targetMode?: string
  ): void {
    for (const skill of skills) {
      this.deploySkill(skill, toolConfig, mode, targetMode);
    }
  }

  removeSkill(skillName: string, toolConfig: ToolConfig, targetMode?: string): void {
    const targetDir = getTargetDir(toolConfig, targetMode);
    const skillPath = join(this.projectDir, targetDir, skillName);
    if (existsSync(skillPath)) {
      rmSync(skillPath, { recursive: true, force: true });
    }
  }

  getDeployedSkillPath(skillName: string, toolConfig: ToolConfig, targetMode?: string): string {
    const targetDir = getTargetDir(toolConfig, targetMode);
    return join(this.projectDir, targetDir, skillName);
  }

  isSkillDeployed(skillName: string, toolConfig: ToolConfig, targetMode?: string): boolean {
    const skillPath = this.getDeployedSkillPath(skillName, toolConfig, targetMode);
    return existsSync(skillPath);
  }
}

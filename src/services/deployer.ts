import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { SkillInfo, CommandInfo, ToolConfig } from '../types.js';
import { ensureDir, linkDir, copyDir, linkFile, copyFile, removeFile } from '../utils/fs.js';
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

  deployCommand(
    command: CommandInfo,
    toolConfig: ToolConfig,
    mode: 'link' | 'copy'
  ): void {
    const commandsDir = toolConfig.commandsDir;
    if (!commandsDir) return;

    const fullTargetDir = join(this.projectDir, commandsDir);
    ensureDir(fullTargetDir);

    const commandTargetPath = join(fullTargetDir, `${command.name}.md`);

    if (mode === 'link') {
      linkFile(command.path, commandTargetPath);
    } else {
      copyFile(command.path, commandTargetPath);
    }
  }

  deployCommands(
    commands: CommandInfo[],
    toolConfig: ToolConfig,
    mode: 'link' | 'copy'
  ): void {
    for (const command of commands) {
      this.deployCommand(command, toolConfig, mode);
    }
  }

  removeCommand(commandName: string, toolConfig: ToolConfig): void {
    const commandsDir = toolConfig.commandsDir;
    if (!commandsDir) return;

    const commandPath = join(this.projectDir, commandsDir, `${commandName}.md`);
    removeFile(commandPath);
  }

  getDeployedCommandPath(commandName: string, toolConfig: ToolConfig): string | undefined {
    const commandsDir = toolConfig.commandsDir;
    if (!commandsDir) return undefined;

    return join(this.projectDir, commandsDir, `${commandName}.md`);
  }

  isCommandDeployed(commandName: string, toolConfig: ToolConfig): boolean {
    const commandPath = this.getDeployedCommandPath(commandName, toolConfig);
    if (!commandPath) return false;
    return existsSync(commandPath);
  }
}

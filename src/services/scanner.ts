import { join } from 'path';
import { readdirSync } from 'fs';
import { ToolName, ToolConfig } from '../types.js';
import { SUPPORTED_TOOLS, SKILLS_MANAGER_DIR } from '../constants.js';
import { TOOL_CONFIGS, getTargetDir } from '../tools/configs.js';
import { fileExists, isSymlink, readSymlinkTarget } from '../utils/fs.js';
import { SkillsService } from './skills.js';

export interface ScannedSkill {
  name: string;
  source: string;
  deployMode: 'link' | 'copy';
  path: string;
}

export interface ScannedToolDeployment {
  toolName: ToolName;
  targetDir: string;
  mode?: string;
  skills: ScannedSkill[];
}

export class DeploymentScanner {
  private skillsService: SkillsService;

  constructor(
    private projectDir: string,
    private skillsManagerDir: string = SKILLS_MANAGER_DIR
  ) {
    this.skillsService = new SkillsService(this.skillsManagerDir);
  }

  scanAllTools(): ScannedToolDeployment[] {
    const deployments: ScannedToolDeployment[] = [];

    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      const toolDeployments = this.scanToolDeployment(toolName, config);
      deployments.push(...toolDeployments);
    }

    return deployments.filter((d) => d.skills.length > 0);
  }

  scanToolDeployment(toolName: ToolName, config: ToolConfig): ScannedToolDeployment[] {
    const deployments: ScannedToolDeployment[] = [];

    // Scan base directory
    const baseDir = join(this.projectDir, config.skillsDir);
    const baseDeployment = this.scanDirectory(toolName, baseDir, config.skillsDir);
    if (baseDeployment.skills.length > 0) {
      deployments.push(baseDeployment);
    }

    // Scan mode-specific directories if supported
    if (config.supportsModeSpecific && config.availableModes) {
      for (const mode of config.availableModes) {
        const modeDir = getTargetDir(config, mode);
        const fullModeDir = join(this.projectDir, modeDir);
        const modeDeployment = this.scanDirectory(toolName, fullModeDir, modeDir, mode);
        if (modeDeployment.skills.length > 0) {
          deployments.push(modeDeployment);
        }
      }
    }

    return deployments;
  }

  getConfiguredTools(): ToolName[] {
    const tools = new Set<ToolName>();

    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      const deployments = this.scanToolDeployment(toolName, config);
      if (deployments.some((d) => d.skills.length > 0)) {
        tools.add(toolName);
      }
    }

    return Array.from(tools);
  }

  isToolConfigured(toolName: ToolName): boolean {
    const config = TOOL_CONFIGS[toolName];
    if (!config) return false;

    const deployments = this.scanToolDeployment(toolName, config);
    return deployments.some((d) => d.skills.length > 0);
  }

  getDeployedSkills(toolName: ToolName): ScannedSkill[] {
    const config = TOOL_CONFIGS[toolName];
    if (!config) return [];

    const deployments = this.scanToolDeployment(toolName, config);
    return deployments.flatMap((d) => d.skills);
  }

  private scanDirectory(
    toolName: ToolName,
    fullPath: string,
    relativePath: string,
    mode?: string
  ): ScannedToolDeployment {
    const deployment: ScannedToolDeployment = {
      toolName,
      targetDir: relativePath,
      mode,
      skills: [],
    };

    if (!fileExists(fullPath)) {
      return deployment;
    }

    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const skillPath = join(fullPath, entry.name);
        const scanned = this.scanSkill(skillPath, entry.name);
        if (scanned) {
          deployment.skills.push(scanned);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return deployment;
  }

  private scanSkill(skillPath: string, name: string): ScannedSkill | null {
    // Check if it's a valid skill (has SKILL.md)
    const skillMdPath = join(skillPath, 'SKILL.md');
    if (!fileExists(skillMdPath)) {
      return null;
    }

    if (isSymlink(skillPath)) {
      return this.scanLinkedSkill(skillPath, name);
    } else {
      return this.scanCopiedSkill(skillPath, name);
    }
  }

  private scanLinkedSkill(skillPath: string, name: string): ScannedSkill | null {
    const linkTarget = readSymlinkTarget(skillPath);
    if (!linkTarget) {
      return null;
    }

    const source = this.extractSourceFromPath(linkTarget);

    return {
      name,
      source: source || 'unknown',
      deployMode: 'link',
      path: skillPath,
    };
  }

  private scanCopiedSkill(skillPath: string, name: string): ScannedSkill | null {
    const source = this.findSourceByName(name);

    return {
      name,
      source: source || 'unknown',
      deployMode: 'copy',
      path: skillPath,
    };
  }

  private extractSourceFromPath(linkTarget: string): string | null {
    // Normalize path
    const normalizedTarget = linkTarget.replace(/\\/g, '/');
    const skillsManagerPattern = '.skills-manager/';

    const idx = normalizedTarget.indexOf(skillsManagerPattern);
    if (idx === -1) return null;

    const afterManager = normalizedTarget.substring(idx + skillsManagerPattern.length);
    // Format: {source}/{repo}/[skills/]{skill-name}
    // or: custom/{skill-name}

    const parts = afterManager.split('/');

    if (parts[0] === 'custom') {
      return 'custom';
    }

    // official/anthropic/skills/skill-name or official/anthropic/skill-name
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }

    return null;
  }

  private findSourceByName(skillName: string): string | null {
    const matches = this.skillsService.findSkillsByName(skillName);

    if (matches.length === 0) {
      return null;
    }

    // Return first match (could be multiple with same name)
    return matches[0].source;
  }
}

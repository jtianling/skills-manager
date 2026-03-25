import { join } from 'path';
import { readdirSync } from 'fs';
import { ToolName } from '../types.js';
import { SUPPORTED_TOOLS, SKILLS_MANAGER_DIR } from '../constants.js';
import { TOOL_CONFIGS, AGENTS_SKILLS_DIR } from '../tools/configs.js';
import { fileExists, isSymlink, readSymlinkTarget } from '../utils/fs.js';
import { SkillsService } from './skills.js';

export interface ScannedSkill {
  name: string;
  source: string;
  deployMode: 'link' | 'copy';
  path: string;
  conflict?: boolean;
}

export interface ScannedToolDeployment {
  toolName: ToolName;
  targetDir: string;
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

  scanDeployedSkills(): ScannedSkill[] {
    const fullPath = join(this.projectDir, AGENTS_SKILLS_DIR);

    if (!fileExists(fullPath)) {
      return [];
    }

    const skills: ScannedSkill[] = [];

    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        const skillPath = join(fullPath, entry.name);
        const scanned = this.scanSkill(skillPath, entry.name);
        if (scanned) {
          skills.push(scanned);
        }
      }
    } catch {
      // Directory can't be read
    }

    return skills;
  }

  scanAllTools(): ScannedToolDeployment[] {
    const skills = this.scanDeployedSkills();

    if (skills.length === 0) {
      return [];
    }

    const configuredTools = this.getConfiguredTools();
    return configuredTools.map((toolName) => ({
      toolName,
      targetDir: AGENTS_SKILLS_DIR,
      skills,
    }));
  }

  getConfiguredTools(): ToolName[] {
    const tools: ToolName[] = [];
    const hasSkills = this.scanDeployedSkills().length > 0;

    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];

      if (config.native) {
        if (hasSkills) {
          tools.push(toolName);
        }
      } else if (config.symlinkDir) {
        const symlinkPath = join(this.projectDir, config.symlinkDir);
        if (isSymlink(symlinkPath)) {
          tools.push(toolName);
        }
      }
    }

    return tools;
  }

  isToolConfigured(toolName: ToolName): boolean {
    const config = TOOL_CONFIGS[toolName];
    if (!config) return false;

    if (config.native) {
      return this.scanDeployedSkills().length > 0;
    }

    if (config.symlinkDir) {
      const symlinkPath = join(this.projectDir, config.symlinkDir);
      return isSymlink(symlinkPath);
    }

    return false;
  }

  getDeployedSkills(): ScannedSkill[] {
    return this.scanDeployedSkills();
  }

  private scanSkill(skillPath: string, name: string): ScannedSkill | null {
    const skillMdPath = join(skillPath, 'SKILL.md');
    if (!fileExists(skillMdPath)) {
      return null;
    }

    if (isSymlink(skillPath)) {
      return this.scanLinkedSkill(skillPath, name);
    }
    return this.scanCopiedSkill(skillPath, name);
  }

  private scanLinkedSkill(skillPath: string, name: string): ScannedSkill | null {
    const linkTarget = readSymlinkTarget(skillPath);
    if (!linkTarget) {
      return null;
    }

    const source = this.extractSourceFromPath(linkTarget);

    return {
      name,
      source: source ?? 'unknown',
      deployMode: 'link',
      path: skillPath,
    };
  }

  private scanCopiedSkill(skillPath: string, name: string): ScannedSkill | null {
    const { source, conflict } = this.findSourceByName(name);

    return {
      name,
      source: source ?? 'unknown',
      deployMode: 'copy',
      path: skillPath,
      conflict,
    };
  }

  private extractSourceFromPath(linkTarget: string): string | null {
    const normalizedTarget = linkTarget.replace(/\\/g, '/');
    const skillsManagerPattern = '.skills-manager/';

    const idx = normalizedTarget.indexOf(skillsManagerPattern);
    if (idx === -1) return null;

    const afterManager = normalizedTarget.substring(idx + skillsManagerPattern.length);

    const parts = afterManager.split('/');

    if (parts[0] === 'custom') {
      return 'custom';
    }

    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }

    return null;
  }

  private findSourceByName(skillName: string): { source: string | null; conflict: boolean } {
    const matches = this.skillsService.findSkillsByName(skillName);

    if (matches.length === 0) {
      return { source: null, conflict: false };
    }

    if (matches.length > 1) {
      return { source: null, conflict: true };
    }

    return { source: matches[0].source, conflict: false };
  }
}

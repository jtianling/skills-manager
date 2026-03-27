import { ToolName, SkillSource } from './constants.js';

export { ToolName, SkillSource };

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: string; // e.g., "official/anthropic" or "community/awesome-skills"
}

export interface DeployedSkill {
  name: string;
  source: string;
  deployMode: 'link' | 'copy';
}


export interface ToolConfig {
  name: ToolName;
  displayName: string;
  skillsDir: string;
  supportsLink: boolean;
  native: boolean;
  symlinkDir?: string;
}

export interface InstallOptions {
  all?: boolean;
  custom?: boolean;
}

export interface InitOptions {
  copy?: boolean;
}

export interface AddOptions {
  copy?: boolean;
  agent?: string;
  sameAgents?: boolean;
}

export interface ListOptions {
  deployed?: boolean;
}

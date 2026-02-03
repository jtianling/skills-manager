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

export interface ToolDeployment {
  targetDir: string;
  mode: string; // "all" or specific mode like "code", "architect"
  deployedAt: string;
  skills: DeployedSkill[];
}

export interface ProjectMetadata {
  version: string;
  tools: Record<string, ToolDeployment>;
}

export interface ToolConfig {
  name: ToolName;
  displayName: string;
  skillsDir: string;
  supportsLink: boolean;
  supportsModeSpecific: boolean;
  modePattern?: string;
  availableModes?: string[];
}

export interface InstallOptions {
  all?: boolean;
  custom?: boolean;
}

export interface InitOptions {
  copy?: boolean;
}

export interface AddOptions {
  tool?: string;
  copy?: boolean;
}

export interface RemoveOptions {
  tool?: string;
}

export interface ListOptions {
  deployed?: boolean;
}

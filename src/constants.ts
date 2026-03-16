import { homedir } from 'os';
import { join } from 'path';

export const SKILLS_MANAGER_DIR = join(homedir(), '.skills-manager');

export const SKILL_SOURCES = ['official', 'community', 'custom'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export const SUPPORTED_TOOLS = [
  'claude-code',
  'codex',
  'gemini-cli',
  'opencode',
  'openclaw',
  'antigravity',
  'cline',
  'cursor',
  'kilo-code',
  'roo-code',
  'trae',
  'windsurf',
] as const;

export type ToolName = (typeof SUPPORTED_TOOLS)[number];

export const ANTHROPIC_SKILLS_REPO = 'https://github.com/anthropics/skills';

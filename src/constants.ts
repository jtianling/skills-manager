import { homedir } from 'os';
import { join } from 'path';

export const SKILLS_MANAGER_DIR = join(homedir(), '.skills-manager');

export const REGISTRY_URL = process.env.SKILLSMGR_REGISTRY || 'https://skillsmgr.dev';

export const SKILL_SOURCES = ['official', 'community', 'custom', 'registry'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export const SUPPORTED_TOOLS = [
  'claude-code',
  'codex',
  'cursor',
  'openclaw',
  'opencode',
  'gemini-cli',
  'github-copilot',
  'cline',
  'kilo',
  'roo',
  'kiro-cli',
  'trae',
  'trae-cn',
  'codebuddy',
  'windsurf',
  'goose',
  'adal',
  'amp',
  'antigravity',
  'augment',
  'command-code',
  'continue',
  'cortex',
  'crush',
  'deepagents',
  'droid',
  'firebender',
  'iflow-cli',
  'junie',
  'kimi-cli',
  'kode',
  'mcpjam',
  'mistral-vibe',
  'mux',
  'neovate',
  'openhands',
  'pi',
  'pochi',
  'qoder',
  'qwen-code',
  'replit',
  'universal',
  'warp',
  'zencoder',
] as const;

export type ToolName = (typeof SUPPORTED_TOOLS)[number];

export const OFFICIAL_OWNERS: Record<string, string> = {
  'anthropic': 'anthropics',
  'openai': 'openai',
  'microsoft': 'microsoft',
  'vercel-labs': 'vercel-labs',
};

export const STANDARD_SKILL_PATHS = [
  'skills',
  'skills/.curated',
  'skills/.experimental',
  'skills/.system',
  '.agents/skills',
  '.claude/skills',
] as const;

export function findOfficialProvider(owner: string): string | null {
  for (const [key, ghOwner] of Object.entries(OFFICIAL_OWNERS)) {
    if (ghOwner === owner) {
      return key;
    }
  }
  return null;
}

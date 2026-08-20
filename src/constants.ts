import { homedir } from 'os';
import { join } from 'path';

export const SKILLS_MANAGER_DIR = join(homedir(), '.skills-manager');

export const REGISTRY_URL = process.env.SKILLSMGR_REGISTRY || 'https://skillsmgr.dev';

export const SKILL_SOURCES = [
  'official',
  'community',
  'custom',
  'registry',
  'well-known',
] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

// Hosts whose http(s) URLs are always treated as git remotes, never probed
// for a well-known skills index.
export const GIT_HOST_EXCLUSIONS = [
  'github.com',
  'gitlab.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
] as const;

// Probed in order; the first path serving a valid index.json wins. Neither
// suffix is registered with IANA, so this list is expected to change.
export const WELL_KNOWN_PATHS = [
  '.well-known/agent-skills',
  '.well-known/skills',
] as const;

// Prefix marking a virtual group member as a dynamic reference to another
// group (e.g. "group:develop"). Distinguishes references from skill keys,
// which are always "<source>/<name>" and never start with this prefix.
export const GROUP_REF_PREFIX = 'group:';

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

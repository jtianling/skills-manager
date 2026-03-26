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

export interface OfficialProvider {
  owner: string;
  repo: string;
  skillsPath?: string;
}

export const OFFICIAL_PROVIDERS: Record<string, OfficialProvider> = {
  'anthropic': { owner: 'anthropics', repo: 'skills' },
  'openai': { owner: 'openai', repo: 'skills' },
  'microsoft': { owner: 'microsoft', repo: 'skills', skillsPath: '.github/skills' },
  'vercel-labs': { owner: 'vercel-labs', repo: 'agent-skills' },
};

export function findOfficialProvider(owner: string, repo: string): string | null {
  for (const [key, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
    if (provider.owner === owner && provider.repo === repo) {
      return key;
    }
  }
  return null;
}

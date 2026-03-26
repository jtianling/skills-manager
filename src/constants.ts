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

export interface OfficialProviderRepo {
  repo: string;
  skillsPath?: string;
}

export interface OfficialProvider {
  owner: string;
  repos: OfficialProviderRepo[];
  aliases?: string[];
}

export interface OfficialMatch {
  providerKey: string;
  exactRepoMatch: boolean;
}

export const OFFICIAL_PROVIDERS: Record<string, OfficialProvider> = {
  'anthropic': { owner: 'anthropics', repos: [{ repo: 'skills' }] },
  'openai': { owner: 'openai', repos: [{ repo: 'skills' }] },
  'microsoft': { owner: 'microsoft', repos: [{ repo: 'skills', skillsPath: '.github/skills' }] },
  'vercel-labs': {
    owner: 'vercel-labs',
    repos: [{ repo: 'agent-skills' }, { repo: 'agent-browser' }],
    aliases: ['vercel'],
  },
};

export function findOfficialProvider(owner: string, repo: string): OfficialMatch | null {
  for (const [key, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
    if (provider.owner === owner) {
      const exactRepoMatch = provider.repos.some((r) => r.repo === repo);
      return { providerKey: key, exactRepoMatch };
    }
  }
  return null;
}

export function resolveProviderAlias(input: string): string | null {
  for (const [key, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
    if (provider.aliases?.includes(input)) {
      return key;
    }
  }
  return null;
}

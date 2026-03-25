import { ToolConfig, ToolName } from '../types.js';

export const AGENTS_SKILLS_DIR = '.agents/skills';

export const TOOL_CONFIGS: Record<ToolName, ToolConfig> = {
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.claude/skills',
  },
  'codex': {
    name: 'codex',
    displayName: 'Codex',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'opencode': {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'openclaw': {
    name: 'openclaw',
    displayName: 'OpenClaw',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'antigravity': {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'cline': {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: true,
  },
  'cursor': {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.cursor/skills',
  },
  'kilo-code': {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.kilocode/skills',
  },
  'roo-code': {
    name: 'roo-code',
    displayName: 'Roo Code',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.roo/skills',
  },
  'trae': {
    name: 'trae',
    displayName: 'Trae',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.trae/skills',
  },
  'windsurf': {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: AGENTS_SKILLS_DIR,
    supportsLink: true,
    native: false,
    symlinkDir: '.windsurf/skills',
  },
};

export function getToolConfig(name: string): ToolConfig | undefined {
  return TOOL_CONFIGS[name as ToolName];
}

export function getTargetDir(): string {
  return AGENTS_SKILLS_DIR;
}

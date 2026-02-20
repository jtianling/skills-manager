import { ToolConfig, ToolName } from '../types.js';

export const TOOL_CONFIGS: Record<ToolName, ToolConfig> = {
  'antigravity': {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'codex-cli': {
    name: 'codex-cli',
    displayName: 'Codex CLI',
    skillsDir: '.agents/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'roo-code': {
    name: 'roo-code',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    skillsDir: '.gemini/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'opencode': {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'cline': {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.cline/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'cursor': {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'kilo-code': {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  'trae': {
    name: 'trae',
    displayName: 'Trae',
    skillsDir: '.trae/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'windsurf': {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
};

export function getToolConfig(name: string): ToolConfig | undefined {
  return TOOL_CONFIGS[name as ToolName];
}

export function getTargetDir(config: ToolConfig, mode?: string): string {
  if (config.supportsModeSpecific && mode && mode !== 'all' && config.modePattern) {
    const baseDir = config.skillsDir.split('/').slice(0, -1).join('/');
    return `${baseDir}/${config.modePattern.replace('{mode}', mode)}`;
  }
  return config.skillsDir;
}

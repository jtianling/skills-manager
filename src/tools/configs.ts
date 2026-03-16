import { ToolConfig, ToolName } from '../types.js';

export const TOOL_CONFIGS: Record<ToolName, ToolConfig> = {
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    commandsDir: '.claude/commands',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'codex': {
    name: 'codex',
    displayName: 'Codex',
    skillsDir: '.codex/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'gemini-cli': {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    skillsDir: '.gemini/skills',
    commandsDir: '.gemini/commands',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'opencode': {
    name: 'opencode',
    displayName: 'OpenCode',
    skillsDir: '.opencode/skills',
    commandsDir: '.opencode/commands',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'openclaw': {
    name: 'openclaw',
    displayName: 'OpenClaw',
    skillsDir: '.openclaw/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'antigravity': {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    commandsDir: '.agent/workflows',
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
    commandsDir: '.cursor/commands',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'kilo-code': {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    commandsDir: '.kilocode/commands',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  'roo-code': {
    name: 'roo-code',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    commandsDir: '.roo/commands',
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
    commandsDir: '.windsurf/workflows',
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

export function getCommandsTargetDir(config: ToolConfig): string | undefined {
  return config.commandsDir;
}

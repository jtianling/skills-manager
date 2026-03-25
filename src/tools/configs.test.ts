import { describe, it, expect } from 'vitest';
import { TOOL_CONFIGS, AGENTS_SKILLS_DIR, getTargetDir, getToolConfig } from './configs.js';
import { SUPPORTED_TOOLS } from '../constants.js';

describe('TOOL_CONFIGS', () => {
  it('all tools have skillsDir as .agents/skills', () => {
    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      expect(config.skillsDir, `${toolName} skillsDir`).toBe(AGENTS_SKILLS_DIR);
    }
  });

  it('native tools have native=true and no symlinkDir', () => {
    const nativeTools = ['codex', 'gemini-cli', 'opencode', 'openclaw', 'antigravity', 'cline'] as const;
    for (const toolName of nativeTools) {
      const config = TOOL_CONFIGS[toolName];
      expect(config.native, `${toolName} native`).toBe(true);
      expect(config.symlinkDir, `${toolName} symlinkDir`).toBeUndefined();
    }
  });

  it('non-native tools have native=false with symlinkDir', () => {
    const symlinkTools = [
      { name: 'claude-code', dir: '.claude/skills' },
      { name: 'cursor', dir: '.cursor/skills' },
      { name: 'kilo-code', dir: '.kilocode/skills' },
      { name: 'roo-code', dir: '.roo/skills' },
      { name: 'trae', dir: '.trae/skills' },
      { name: 'windsurf', dir: '.windsurf/skills' },
    ] as const;

    for (const { name, dir } of symlinkTools) {
      const config = TOOL_CONFIGS[name];
      expect(config.native, `${name} native`).toBe(false);
      expect(config.symlinkDir, `${name} symlinkDir`).toBe(dir);
    }
  });

  it('no tool has mode-specific fields', () => {
    for (const toolName of SUPPORTED_TOOLS) {
      const config: Record<string, unknown> = { ...TOOL_CONFIGS[toolName] };
      expect(config).not.toHaveProperty('supportsModeSpecific');
      expect(config).not.toHaveProperty('modePattern');
      expect(config).not.toHaveProperty('availableModes');
    }
  });
});

describe('getTargetDir', () => {
  it('returns .agents/skills', () => {
    expect(getTargetDir()).toBe('.agents/skills');
  });
});

describe('getToolConfig', () => {
  it('returns config for valid tool name', () => {
    const config = getToolConfig('claude-code');
    expect(config).toBeDefined();
    expect(config?.name).toBe('claude-code');
  });

  it('returns undefined for invalid tool name', () => {
    const config = getToolConfig('nonexistent');
    expect(config).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { TOOL_CONFIGS, AGENTS_SKILLS_DIR, getTargetDir, getToolConfig } from './configs.js';
import { SUPPORTED_TOOLS } from '../constants.js';

describe('TOOL_CONFIGS', () => {
  it('has 44 agent configs', () => {
    expect(SUPPORTED_TOOLS.length).toBe(44);
    for (const toolName of SUPPORTED_TOOLS) {
      expect(TOOL_CONFIGS[toolName], `${toolName} config`).toBeDefined();
    }
  });

  it('all tools have skillsDir as .agents/skills', () => {
    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      expect(config.skillsDir, `${toolName} skillsDir`).toBe(AGENTS_SKILLS_DIR);
    }
  });

  it('all tools have globalSkillsDir', () => {
    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      expect(config.globalSkillsDir, `${toolName} globalSkillsDir`).toBeDefined();
      expect(typeof config.globalSkillsDir).toBe('string');
      expect(config.globalSkillsDir.length).toBeGreaterThan(0);
    }
  });

  it('all tools have showInList boolean', () => {
    for (const toolName of SUPPORTED_TOOLS) {
      const config = TOOL_CONFIGS[toolName];
      expect(typeof config.showInList, `${toolName} showInList`).toBe('boolean');
    }
  });

  it('16 tools have showInList=true', () => {
    const listedTools = SUPPORTED_TOOLS.filter((t) => TOOL_CONFIGS[t].showInList);
    expect(listedTools.length).toBe(17);
  });

  it('native tools have native=true and no symlinkDir', () => {
    const nativeTools = [
      'codex', 'cursor', 'opencode', 'gemini-cli', 'github-copilot', 'cline',
      'amp', 'antigravity', 'warp', 'kimi-cli', 'replit', 'universal',
      'deepagents', 'firebender',
    ] as const;
    for (const toolName of nativeTools) {
      const config = TOOL_CONFIGS[toolName];
      expect(config.native, `${toolName} native`).toBe(true);
      expect(config.symlinkDir, `${toolName} symlinkDir`).toBeUndefined();
    }
  });

  it('non-native tools have native=false with symlinkDir', () => {
    const symlinkTools = [
      { name: 'claude-code', dir: '.claude/skills' },
      { name: 'openclaw', dir: 'skills' },
      { name: 'kilo', dir: '.kilocode/skills' },
      { name: 'roo', dir: '.roo/skills' },
      { name: 'kiro-cli', dir: '.kiro/skills' },
      { name: 'trae', dir: '.trae/skills' },
      { name: 'trae-cn', dir: '.trae/skills' },
      { name: 'codebuddy', dir: '.codebuddy/skills' },
      { name: 'windsurf', dir: '.windsurf/skills' },
      { name: 'goose', dir: '.goose/skills' },
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

  it('trae and trae-cn share project-level symlinkDir .trae/skills', () => {
    expect(TOOL_CONFIGS['trae'].symlinkDir).toBe('.trae/skills');
    expect(TOOL_CONFIGS['trae-cn'].symlinkDir).toBe('.trae/skills');
    expect(TOOL_CONFIGS['trae'].globalSkillsDir).not.toBe(TOOL_CONFIGS['trae-cn'].globalSkillsDir);
  });

  it('all showInList=true agents are in DISPLAY_ORDER', async () => {
    const { DISPLAY_ORDER } = await import('../utils/prompts.js');
    const listedInConfig = SUPPORTED_TOOLS.filter((t) => TOOL_CONFIGS[t].showInList);
    for (const tool of listedInConfig) {
      expect(DISPLAY_ORDER, `${tool} missing from DISPLAY_ORDER`).toContain(tool);
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

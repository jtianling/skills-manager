import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Deployer } from './deployer.js';
import { SkillInfo, ToolConfig } from '../types.js';
import { isSymlink } from '../utils/fs.js';
import { AGENTS_SKILLS_DIR, TOOL_CONFIGS } from '../tools/configs.js';
import { SUPPORTED_TOOLS } from '../constants.js';
import type { ToolName } from '../types.js';

describe('Deployer', () => {
  const testDir = join(tmpdir(), `skillsmgr-deployer-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsDir = join(testDir, 'skills-manager');
  const globalDir = join(testDir, 'global');
  let deployer: Deployer;
  const savedGlobalDirs = new Map<string, string>();

  const mockSkill: SkillInfo = {
    name: 'test-skill',
    description: 'Test skill',
    path: '',
    source: 'official/anthropic',
  };

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(globalDir, { recursive: true });
    mkdirSync(join(skillsDir, 'official', 'anthropic', 'test-skill'), { recursive: true });
    writeFileSync(
      join(skillsDir, 'official', 'anthropic', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Test'
    );
    mockSkill.path = join(skillsDir, 'official', 'anthropic', 'test-skill');
    deployer = new Deployer(projectDir);

    for (const name of SUPPORTED_TOOLS) {
      savedGlobalDirs.set(name, TOOL_CONFIGS[name].globalSkillsDir);
      (TOOL_CONFIGS[name] as { globalSkillsDir: string }).globalSkillsDir = join(globalDir, name);
    }
  });

  afterEach(() => {
    for (const [name, dir] of savedGlobalDirs) {
      (TOOL_CONFIGS[name as ToolName] as { globalSkillsDir: string }).globalSkillsDir = dir;
    }
    savedGlobalDirs.clear();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('deploySkill', () => {
    it('creates symlink in .agents/skills in link mode', () => {
      deployer.deploySkill(mockSkill, 'link');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies directory to .agents/skills in copy mode', () => {
      deployer.deploySkill(mockSkill, 'copy');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });
  });

  describe('removeSkill', () => {
    it('removes deployed skill from .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      const targetPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      deployer.removeSkill('test-skill');
      expect(existsSync(targetPath)).toBe(false);
    });
  });

  describe('createSymlinkBridge', () => {
    const symlinkConfig: ToolConfig = {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: AGENTS_SKILLS_DIR,
      globalSkillsDir: '/tmp/test-global/.claude/skills',
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
      showInList: true,
    };

    it('creates symlink from .claude/skills to .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);

      const symlinkPath = join(projectDir, '.claude', 'skills');
      expect(existsSync(symlinkPath)).toBe(true);
      expect(isSymlink(symlinkPath)).toBe(true);
    });

    it('creates parent directory if it does not exist', () => {
      deployer.deploySkill(mockSkill, 'link');
      deployer.createSymlinkBridge(symlinkConfig);

      const parentDir = join(projectDir, '.claude');
      expect(existsSync(parentDir)).toBe(true);
    });

    it('replaces existing symlink', () => {
      const symlinkPath = join(projectDir, '.claude', 'skills');
      mkdirSync(join(projectDir, '.claude'), { recursive: true });
      mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
      const dummyTarget = join(projectDir, '.agents');
      symlinkSync(dummyTarget, symlinkPath);

      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);
      expect(isSymlink(symlinkPath)).toBe(true);
    });

    it('skips when target is a real directory', () => {
      const symlinkPath = join(projectDir, '.claude', 'skills');
      mkdirSync(symlinkPath, { recursive: true });

      const result = deployer.createSymlinkBridge(symlinkConfig);
      expect(result).toBe(false);
    });

    it('returns false for native tools', () => {
      const nativeConfig: ToolConfig = {
        name: 'codex',
        displayName: 'Codex',
        skillsDir: AGENTS_SKILLS_DIR,
        globalSkillsDir: '/tmp/test-global/.codex/skills',
        supportsLink: true,
        native: true,
        showInList: true,
      };
      const result = deployer.createSymlinkBridge(nativeConfig);
      expect(result).toBe(false);
    });
  });

  describe('removeSymlinkBridge', () => {
    const symlinkConfig: ToolConfig = {
      name: 'claude-code',
      displayName: 'Claude Code',
      skillsDir: AGENTS_SKILLS_DIR,
      globalSkillsDir: '/tmp/test-global/.claude/skills',
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
      showInList: true,
    };

    it('removes symlink without affecting .agents/skills', () => {
      deployer.deploySkill(mockSkill, 'link');
      deployer.createSymlinkBridge(symlinkConfig);

      const symlinkPath = join(projectDir, '.claude', 'skills');
      expect(isSymlink(symlinkPath)).toBe(true);

      const result = deployer.removeSymlinkBridge(symlinkConfig);
      expect(result).toBe(true);
      expect(existsSync(symlinkPath)).toBe(false);

      const agentsPath = join(projectDir, AGENTS_SKILLS_DIR, 'test-skill');
      expect(existsSync(agentsPath)).toBe(true);
    });

    it('returns false when no symlink exists', () => {
      const result = deployer.removeSymlinkBridge(symlinkConfig);
      expect(result).toBe(false);
    });
  });

  describe('deploySkillGlobal', () => {
    it('creates per-skill symlink in global dir', () => {
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      const targetPath = join(globalDir, 'claude-code', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies skill in copy mode', () => {
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'copy');

      const targetPath = join(globalDir, 'claude-code', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });

    it('deduplicates agents sharing same globalSkillsDir', () => {
      const sharedDir = join(globalDir, 'shared');
      (TOOL_CONFIGS['amp'] as { globalSkillsDir: string }).globalSkillsDir = sharedDir;
      (TOOL_CONFIGS['kimi-cli'] as { globalSkillsDir: string }).globalSkillsDir = sharedDir;

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      deployer.deploySkillGlobal(mockSkill, ['amp', 'kimi-cli'], 'link');

      const logCalls = spy.mock.calls.filter((c) => String(c[0]).includes('✓ test-skill'));
      expect(logCalls.length).toBe(1);
      spy.mockRestore();
    });

    it('skips when target is a real directory', () => {
      const targetDir = join(globalDir, 'claude-code');
      mkdirSync(join(targetDir, 'test-skill', 'subdir'), { recursive: true });

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('is a real directory, skipping'));
      spy.mockRestore();
    });

    it('replaces existing symlink', () => {
      const targetDir = join(globalDir, 'claude-code');
      mkdirSync(targetDir, { recursive: true });
      symlinkSync('/tmp/dummy', join(targetDir, 'test-skill'));

      deployer.deploySkillGlobal(mockSkill, ['claude-code'], 'link');

      const targetPath = join(targetDir, 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Deployer } from './deployer.js';
import { SkillInfo, ToolConfig } from '../types.js';
import { isSymlink } from '../utils/fs.js';
import { AGENTS_SKILLS_DIR } from '../tools/configs.js';

describe('Deployer', () => {
  const testDir = join(tmpdir(), `skillsmgr-deployer-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsDir = join(testDir, 'skills-manager');
  let deployer: Deployer;

  const mockSkill: SkillInfo = {
    name: 'test-skill',
    description: 'Test skill',
    path: '',
    source: 'official/anthropic',
  };

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(skillsDir, 'official', 'anthropic', 'test-skill'), { recursive: true });
    writeFileSync(
      join(skillsDir, 'official', 'anthropic', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Test'
    );
    mockSkill.path = join(skillsDir, 'official', 'anthropic', 'test-skill');
    deployer = new Deployer(projectDir);
  });

  afterEach(() => {
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
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
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
        supportsLink: true,
        native: true,
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
      supportsLink: true,
      native: false,
      symlinkDir: '.claude/skills',
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
});

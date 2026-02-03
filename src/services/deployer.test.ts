import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Deployer } from './deployer.js';
import { SkillInfo, ToolConfig } from '../types.js';
import { isSymlink } from '../utils/fs.js';

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

  const mockToolConfig: ToolConfig = {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    supportsLink: true,
    supportsModeSpecific: false,
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
    it('creates symlink in link mode', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'link');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies directory in copy mode', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'copy');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });
  });

  describe('removeSkill', () => {
    it('removes deployed skill', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'link');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      deployer.removeSkill('test-skill', mockToolConfig);
      expect(existsSync(targetPath)).toBe(false);
    });
  });
});

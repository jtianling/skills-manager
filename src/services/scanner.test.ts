import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DeploymentScanner } from './scanner.js';

describe('DeploymentScanner', () => {
  const testDir = join(tmpdir(), `skillsmgr-scanner-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsManagerDir = join(testDir, '.skills-manager');

  beforeEach(() => {
    mkdirSync(join(skillsManagerDir, 'official', 'anthropic', 'test-skill'), { recursive: true });
    writeFileSync(
      join(skillsManagerDir, 'official', 'anthropic', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Test'
    );
    mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('scanDeployedSkills', () => {
    it('scans skills from .agents/skills only', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const targetPath = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const skills = scanner.scanDeployedSkills();

      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('test-skill');
    });

    it('returns empty array when .agents/skills does not exist', () => {
      rmSync(join(projectDir, '.agents'), { recursive: true, force: true });

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const skills = scanner.scanDeployedSkills();

      expect(skills).toEqual([]);
    });
  });

  describe('getConfiguredTools', () => {
    it('native tools are configured when skills exist', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const targetPath = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const tools = scanner.getConfiguredTools();

      expect(tools).toContain('codex');
      expect(tools).toContain('cursor');
      expect(tools).toContain('gemini-cli');
      expect(tools).toContain('opencode');
      expect(tools).toContain('antigravity');
      expect(tools).toContain('cline');
    });

    it('native tools are not configured when no skills exist', () => {
      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const tools = scanner.getConfiguredTools();

      expect(tools).not.toContain('codex');
    });

    it('non-native tool is configured when symlink exists', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const skillTarget = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, skillTarget);

      const agentsSkillsPath = join(projectDir, '.agents', 'skills');
      mkdirSync(join(projectDir, '.claude'), { recursive: true });
      symlinkSync(agentsSkillsPath, join(projectDir, '.claude', 'skills'));

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const tools = scanner.getConfiguredTools();

      expect(tools).toContain('claude-code');
    });

    it('non-native tool is not configured without symlink', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const targetPath = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const tools = scanner.getConfiguredTools();

      expect(tools).not.toContain('claude-code');
      expect(tools).not.toContain('kilo');
    });

    it('real directory is not detected as symlink bridge', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const targetPath = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, targetPath);

      mkdirSync(join(projectDir, '.kilocode', 'skills'), { recursive: true });

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const tools = scanner.getConfiguredTools();

      expect(tools).not.toContain('kilo');
    });
  });

  describe('scanAllTools', () => {
    it('returns configured tools with shared skills list', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'test-skill');
      const targetPath = join(projectDir, '.agents', 'skills', 'test-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const deployments = scanner.scanAllTools();

      for (const deployment of deployments) {
        expect(deployment.targetDir).toBe('.agents/skills');
        expect(deployment.skills.length).toBe(1);
        expect(deployment.skills[0].name).toBe('test-skill');
      }
    });

    it('returns empty array when no skills deployed', () => {
      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const deployments = scanner.scanAllTools();

      expect(deployments).toEqual([]);
    });
  });
});

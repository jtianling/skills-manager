import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DeploymentScanner } from '../services/scanner.js';

describe('preserve-unmanaged-skills', () => {
  const testDir = join(tmpdir(), `skillsmgr-unmanaged-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsManagerDir = join(testDir, '.skills-manager');

  beforeEach(() => {
    mkdirSync(join(skillsManagerDir, 'official', 'anthropic', 'managed-skill'), { recursive: true });
    writeFileSync(
      join(skillsManagerDir, 'official', 'anthropic', 'managed-skill', 'SKILL.md'),
      '---\nname: managed-skill\ndescription: A managed skill\n---\n# Managed'
    );

    mkdirSync(join(projectDir, '.claude', 'skills'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('scanner identifies unmanaged skills', () => {
    it('returns source "unknown" for a copied skill not in registry', () => {
      const unmanagedPath = join(projectDir, '.claude', 'skills', 'user-created-skill');
      mkdirSync(unmanagedPath, { recursive: true });
      writeFileSync(join(unmanagedPath, 'SKILL.md'), '---\nname: user-created-skill\n---\n# User skill');

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const skills = scanner.getDeployedSkills('claude-code');

      const unmanaged = skills.find((s) => s.name === 'user-created-skill');
      expect(unmanaged).toBeDefined();
      expect(unmanaged!.source).toBe('unknown');
    });

    it('returns known source for a symlinked managed skill', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'managed-skill');
      const targetPath = join(projectDir, '.claude', 'skills', 'managed-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const skills = scanner.getDeployedSkills('claude-code');

      const managed = skills.find((s) => s.name === 'managed-skill');
      expect(managed).toBeDefined();
      expect(managed!.source).toBe('official/anthropic');
      expect(managed!.source).not.toBe('unknown');
    });
  });

  describe('init toRemove filter logic', () => {
    it('excludes unmanaged skills from toRemove', () => {
      const unmanagedPath = join(projectDir, '.claude', 'skills', 'user-created-skill');
      mkdirSync(unmanagedPath, { recursive: true });
      writeFileSync(join(unmanagedPath, 'SKILL.md'), '---\nname: user-created-skill\n---\n# User skill');

      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'managed-skill');
      const targetPath = join(projectDir, '.claude', 'skills', 'managed-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const previouslyDeployed = scanner.getDeployedSkills('claude-code');
      const selectedSkillNames: string[] = [];

      const toRemove = previouslyDeployed.filter(
        (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
      );
      const unmanaged = previouslyDeployed.filter(
        (s) => s.source === 'unknown'
      );

      expect(toRemove.some((s) => s.name === 'user-created-skill')).toBe(false);
      expect(toRemove.some((s) => s.name === 'managed-skill')).toBe(true);
      expect(unmanaged.some((s) => s.name === 'user-created-skill')).toBe(true);
    });

    it('keeps managed selected skills out of toRemove', () => {
      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'managed-skill');
      const targetPath = join(projectDir, '.claude', 'skills', 'managed-skill');
      symlinkSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const previouslyDeployed = scanner.getDeployedSkills('claude-code');
      const selectedSkillNames = ['managed-skill'];

      const toRemove = previouslyDeployed.filter(
        (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
      );

      expect(toRemove.length).toBe(0);
    });
  });

  describe('unmanaged items survive init deployment', () => {
    it('unmanaged skill directory still exists after managed skill removal', () => {
      const unmanagedPath = join(projectDir, '.claude', 'skills', 'user-created-skill');
      mkdirSync(unmanagedPath, { recursive: true });
      writeFileSync(join(unmanagedPath, 'SKILL.md'), '---\nname: user-created-skill\n---\n# User skill');

      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'managed-skill');
      const managedPath = join(projectDir, '.claude', 'skills', 'managed-skill');
      symlinkSync(sourcePath, managedPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const previouslyDeployed = scanner.getDeployedSkills('claude-code');
      const selectedSkillNames: string[] = [];

      const toRemove = previouslyDeployed.filter(
        (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
      );

      for (const skill of toRemove) {
        rmSync(join(projectDir, '.claude', 'skills', skill.name), { recursive: true, force: true });
      }

      expect(existsSync(unmanagedPath)).toBe(true);
      expect(existsSync(join(unmanagedPath, 'SKILL.md'))).toBe(true);
      expect(existsSync(managedPath)).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync, copyFileSync } from 'fs';
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

    mkdirSync(join(skillsManagerDir, 'official', 'anthropic', 'commands'), { recursive: true });
    writeFileSync(
      join(skillsManagerDir, 'official', 'anthropic', 'commands', 'managed-cmd.md'),
      '---\nname: managed-cmd\ndescription: A managed command\n---\n# Managed Cmd'
    );

    mkdirSync(join(projectDir, '.claude', 'skills'), { recursive: true });
    mkdirSync(join(projectDir, '.claude', 'commands'), { recursive: true });
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

  describe('scanner identifies unmanaged commands', () => {
    it('returns source "unknown" for a copied command not in registry', () => {
      writeFileSync(
        join(projectDir, '.claude', 'commands', 'user-cmd.md'),
        '---\nname: user-cmd\n---\n# User command'
      );

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const commands = scanner.getDeployedCommands('claude-code');

      const unmanaged = commands.find((c) => c.name === 'user-cmd');
      expect(unmanaged).toBeDefined();
      expect(unmanaged!.source).toBe('unknown');
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

    it('excludes unmanaged commands from toRemove', () => {
      writeFileSync(
        join(projectDir, '.claude', 'commands', 'user-cmd.md'),
        '---\nname: user-cmd\n---\n# User command'
      );

      const sourcePath = join(skillsManagerDir, 'official', 'anthropic', 'commands', 'managed-cmd.md');
      const targetPath = join(projectDir, '.claude', 'commands', 'managed-cmd.md');
      copyFileSync(sourcePath, targetPath);

      const scanner = new DeploymentScanner(projectDir, skillsManagerDir);
      const previouslyDeployed = scanner.getDeployedCommands('claude-code');
      const selectedCommandNames: string[] = [];

      const toRemove = previouslyDeployed.filter(
        (c) => !selectedCommandNames.includes(c.name) && c.source !== 'unknown'
      );
      const unmanaged = previouslyDeployed.filter(
        (c) => c.source === 'unknown'
      );

      expect(toRemove.some((c) => c.name === 'user-cmd')).toBe(false);
      expect(toRemove.some((c) => c.name === 'managed-cmd')).toBe(true);
      expect(unmanaged.some((c) => c.name === 'user-cmd')).toBe(true);
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

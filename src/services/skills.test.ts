import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SkillsService } from './skills.js';

describe('SkillsService', () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}`);
  let service: SkillsService;

  beforeEach(() => {
    mkdirSync(join(testDir, 'official', 'anthropic', 'code-review'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'awesome', 'react-patterns'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'my-skill'), { recursive: true });

    writeFileSync(
      join(testDir, 'official', 'anthropic', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: Reviews code\n---\n# Code Review'
    );
    writeFileSync(
      join(testDir, 'community', 'awesome', 'react-patterns', 'SKILL.md'),
      '---\nname: react-patterns\ndescription: React patterns\n---\n# React'
    );
    writeFileSync(
      join(testDir, 'custom', 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: My custom skill\n---\n# My Skill'
    );

    service = new SkillsService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getAllSkills', () => {
    it('returns skills from all sources', () => {
      const skills = service.getAllSkills();
      expect(skills.length).toBe(3);
    });

    it('includes correct source paths', () => {
      const skills = service.getAllSkills();
      const sources = skills.map((s) => s.source).sort();
      expect(sources).toEqual([
        'community/awesome',
        'custom',
        'official/anthropic',
      ]);
    });
  });

  describe('getSkillByName', () => {
    it('finds skill by name', () => {
      const skill = service.getSkillByName('code-review');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('code-review');
    });

    it('returns undefined for unknown skill', () => {
      const skill = service.getSkillByName('unknown');
      expect(skill).toBeUndefined();
    });
  });

  describe('parseSkillMd', () => {
    it('extracts name and description from frontmatter', () => {
      const skill = service.getSkillByName('code-review');
      expect(skill?.name).toBe('code-review');
      expect(skill?.description).toBe('Reviews code');
    });
  });
});

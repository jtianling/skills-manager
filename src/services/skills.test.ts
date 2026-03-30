import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SkillsService } from './skills.js';

describe('SkillsService', () => {
  let testDir: string;
  let service: SkillsService;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'some-user', 'awesome', 'react-patterns'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'my-skill'), { recursive: true });

    writeFileSync(
      join(testDir, 'official', 'anthropic', 'skills', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: Reviews code\n---\n# Code Review'
    );
    writeFileSync(
      join(testDir, 'community', 'some-user', 'awesome', 'react-patterns', 'SKILL.md'),
      '---\nname: react-patterns\ndescription: React patterns\n---\n# React'
    );
    writeFileSync(
      join(testDir, 'custom', 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: My custom skill\n---\n# My Skill'
    );

    service = new SkillsService(testDir);
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getAllSkills', () => {
    it('returns skills from all sources', () => {
      const skills = service.getAllSkills();
      expect(skills.length).toBe(3);
    });

    it('includes correct source paths with three-level official', () => {
      const skills = service.getAllSkills();
      const sources = skills.map((s) => s.source).sort();
      expect(sources).toEqual([
        'community/some-user/awesome',
        'custom',
        'official/anthropic/skills',
      ]);
    });
  });

  describe('official three-level traversal', () => {
    it('traverses official/{providerKey}/{repoName}/{skillName}', () => {
      const skill = service.getSkillByName('code-review');
      expect(skill).toBeDefined();
      expect(skill?.source).toBe('official/anthropic/skills');
    });

    it('handles multiple repos under same provider', () => {
      mkdirSync(join(testDir, 'official', 'vercel-labs', 'agent-skills', 'deploy'), { recursive: true });
      mkdirSync(join(testDir, 'official', 'vercel-labs', 'agent-browser', 'browser'), { recursive: true });

      writeFileSync(
        join(testDir, 'official', 'vercel-labs', 'agent-skills', 'deploy', 'SKILL.md'),
        '---\nname: deploy\ndescription: Deploy skill\n---\n'
      );
      writeFileSync(
        join(testDir, 'official', 'vercel-labs', 'agent-browser', 'browser', 'SKILL.md'),
        '---\nname: browser\ndescription: Browser skill\n---\n'
      );

      const freshService = new SkillsService(testDir);
      const skills = freshService.getAllSkills();
      const officialSkills = skills.filter((s) => s.source.startsWith('official'));

      expect(officialSkills).toHaveLength(3);
      const sources = officialSkills.map((s) => s.source).sort();
      expect(sources).toEqual([
        'official/anthropic/skills',
        'official/vercel-labs/agent-browser',
        'official/vercel-labs/agent-skills',
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

  describe('custom scanning (two-level)', () => {
    it('detects custom skill (has SKILL.md)', () => {
      const skill = service.getSkillByName('my-skill');
      expect(skill).toBeDefined();
      expect(skill?.source).toBe('custom');
    });

    it('ignores empty subdirectories at both levels', () => {
      mkdirSync(join(testDir, 'custom', 'empty-dir'), { recursive: true });

      const freshService = new SkillsService(testDir);
      const skills = freshService.getAllSkills();
      const customSkills = skills.filter((s) => s.source.startsWith('custom'));
      expect(customSkills).toHaveLength(1);
      expect(customSkills[0].name).toBe('my-skill');
    });

    it('finds skills in group subdirectories', () => {
      mkdirSync(join(testDir, 'custom', 'my-tools', 'tool-a'), { recursive: true });
      writeFileSync(
        join(testDir, 'custom', 'my-tools', 'tool-a', 'SKILL.md'),
        '---\nname: tool-a\ndescription: A tool\n---\n'
      );

      const freshService = new SkillsService(testDir);
      const skill = freshService.getSkillByName('tool-a');
      expect(skill).toBeDefined();
      expect(skill?.source).toBe('custom');
    });

    it('finds mixed flat and nested skills', () => {
      mkdirSync(join(testDir, 'custom', 'openspec', 'openspec-explore'), { recursive: true });
      writeFileSync(
        join(testDir, 'custom', 'openspec', 'openspec-explore', 'SKILL.md'),
        '---\nname: openspec-explore\ndescription: Explore\n---\n'
      );

      const freshService = new SkillsService(testDir);
      const customSkills = freshService.getSkillsBySource('custom');
      const names = customSkills.map((s) => s.name).sort();
      expect(names).toEqual(['my-skill', 'openspec-explore']);
    });

    it('does not recurse into skill directories', () => {
      mkdirSync(join(testDir, 'custom', 'my-skill', 'nested'), { recursive: true });
      writeFileSync(
        join(testDir, 'custom', 'my-skill', 'nested', 'SKILL.md'),
        '---\nname: nested\ndescription: Nested\n---\n'
      );

      const freshService = new SkillsService(testDir);
      const skill = freshService.getSkillByName('nested');
      expect(skill).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SkillsService } from '../services/skills.js';

describe('list command two-level grouping', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-list-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    mkdirSync(join(testDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    mkdirSync(join(testDir, 'official', 'anthropic', 'skills', 'commit-msg'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'obra', 'superpowers', 'skill-a'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'obra', 'superpowers', 'skill-b'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'my-tools', 'tool-a'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'solo-skill'), { recursive: true });

    const skills = [
      ['official/anthropic/skills/code-review', 'code-review', 'Reviews code'],
      ['official/anthropic/skills/commit-msg', 'commit-msg', 'Commit messages'],
      ['community/obra/superpowers/skill-a', 'skill-a', 'Skill A'],
      ['community/obra/superpowers/skill-b', 'skill-b', 'Skill B'],
      ['custom/my-tools/tool-a', 'tool-a', 'Tool A'],
      ['custom/solo-skill', 'solo-skill', 'Solo skill'],
    ];

    for (const [path, name, desc] of skills) {
      writeFileSync(
        join(testDir, path, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${desc}\n---\n`
      );
    }
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('groups skills by category and subGroup', () => {
    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const byCategory: Record<string, Record<string, string[]>> = {};
    const ungroupedByCategory: Record<string, string[]> = {};

    for (const skill of skills) {
      const parts = skill.source.split('/');
      const category = parts[0];
      const groupId = parts.length > 1 ? parts.slice(1).join('/') : undefined;

      if (groupId) {
        if (!byCategory[category]) byCategory[category] = {};
        if (!byCategory[category][groupId]) byCategory[category][groupId] = [];
        byCategory[category][groupId].push(skill.name);
      } else {
        if (!ungroupedByCategory[category]) ungroupedByCategory[category] = [];
        ungroupedByCategory[category].push(skill.name);
      }
    }

    expect(byCategory['official']).toBeDefined();
    expect(byCategory['official']['anthropic/skills']).toEqual(
      expect.arrayContaining(['code-review', 'commit-msg'])
    );

    expect(byCategory['community']).toBeDefined();
    expect(byCategory['community']['obra/superpowers']).toEqual(
      expect.arrayContaining(['skill-a', 'skill-b'])
    );

    expect(byCategory['custom']).toBeDefined();
    expect(byCategory['custom']['my-tools']).toEqual(['tool-a']);

    expect(ungroupedByCategory['custom']).toEqual(['solo-skill']);
  });

  it('counts total skills per category correctly', () => {
    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const categoryCounts: Record<string, number> = {};
    for (const skill of skills) {
      const category = skill.source.split('/')[0];
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    expect(categoryCounts['official']).toBe(2);
    expect(categoryCounts['community']).toBe(2);
    expect(categoryCounts['custom']).toBe(2);
  });

  it('handles ungrouped custom skills separately from grouped ones', () => {
    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const customSkills = skills.filter((s) => s.source.startsWith('custom'));
    const grouped = customSkills.filter((s) => s.source.includes('/'));
    const ungrouped = customSkills.filter((s) => !s.source.includes('/'));

    expect(grouped).toHaveLength(1);
    expect(grouped[0].name).toBe('tool-a');
    expect(grouped[0].source).toBe('custom/my-tools');

    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0].name).toBe('solo-skill');
    expect(ungrouped[0].source).toBe('custom');
  });

  it('shows multi-repo provider with separate groupIds', () => {
    mkdirSync(join(testDir, 'official', 'vercel-labs', 'agent-skills', 'deploy'), { recursive: true });
    mkdirSync(join(testDir, 'official', 'vercel-labs', 'agent-browser', 'browser'), { recursive: true });

    writeFileSync(
      join(testDir, 'official', 'vercel-labs', 'agent-skills', 'deploy', 'SKILL.md'),
      '---\nname: deploy\ndescription: Deploy\n---\n'
    );
    writeFileSync(
      join(testDir, 'official', 'vercel-labs', 'agent-browser', 'browser', 'SKILL.md'),
      '---\nname: browser\ndescription: Browser\n---\n'
    );

    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const byCategory: Record<string, Record<string, string[]>> = {};
    for (const skill of skills) {
      const parts = skill.source.split('/');
      const category = parts[0];
      const groupId = parts.length > 1 ? parts.slice(1).join('/') : undefined;
      if (groupId) {
        if (!byCategory[category]) byCategory[category] = {};
        if (!byCategory[category][groupId]) byCategory[category][groupId] = [];
        byCategory[category][groupId].push(skill.name);
      }
    }

    expect(byCategory['official']['vercel-labs/agent-skills']).toEqual(['deploy']);
    expect(byCategory['official']['vercel-labs/agent-browser']).toEqual(['browser']);
  });
});

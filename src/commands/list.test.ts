import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SkillsService } from '../services/skills.js';
import { renderAvailableBody } from './list.js';
import { SkillInfo } from '../types.js';

describe('list command two-level grouping', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-list-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    mkdirSync(join(testDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    mkdirSync(join(testDir, 'official', 'anthropic', 'skills', 'commit-msg'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'obra', 'superpowers', 'skill-a'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'obra', 'superpowers', 'skill-b'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'tool-a'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'solo-skill'), { recursive: true });

    const skills = [
      ['official/anthropic/skills/code-review', 'code-review', 'Reviews code'],
      ['official/anthropic/skills/commit-msg', 'commit-msg', 'Commit messages'],
      ['community/obra/superpowers/skill-a', 'skill-a', 'Skill A'],
      ['community/obra/superpowers/skill-b', 'skill-b', 'Skill B'],
      ['custom/tool-a', 'tool-a', 'Tool A'],
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

    // Custom skills are all flat (no subGroup)
    expect(ungroupedByCategory['custom']).toEqual(
      expect.arrayContaining(['tool-a', 'solo-skill'])
    );
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

  it('custom skills all have flat source (no subGroup)', () => {
    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const customSkills = skills.filter((s) => s.source.startsWith('custom'));
    expect(customSkills).toHaveLength(2);

    for (const skill of customSkills) {
      expect(skill.source).toBe('custom');
    }
  });

  it('custom ungrouped skills display flat without (ungrouped) label', () => {
    const service = new SkillsService(testDir);
    const skills = service.getAllSkills();

    const ungroupedByCategory: Record<string, string[]> = {};

    for (const skill of skills) {
      const parts = skill.source.split('/');
      const category = parts[0];
      const groupId = parts.length > 1 ? parts.slice(1).join('/') : undefined;

      if (!groupId) {
        if (!ungroupedByCategory[category]) ungroupedByCategory[category] = [];
        ungroupedByCategory[category].push(skill.name);
      }
    }

    const lines: string[] = [];
    const ungrouped = ungroupedByCategory['custom'] || [];

    for (const name of ungrouped) {
      lines.push(`  ${name}`);
    }

    expect(ungrouped.length).toBe(2);
    expect(lines).not.toContainEqual(expect.stringContaining('(ungrouped)'));
    expect(lines).toContainEqual(expect.stringContaining('tool-a'));
    expect(lines).toContainEqual(expect.stringContaining('solo-skill'));
  });

  it('ungrouped custom skills display at same indent as other categories', () => {
    mkdirSync(join(testDir, 'custom', 'my-tools', 'linter'), { recursive: true });
    writeFileSync(
      join(testDir, 'custom', 'my-tools', 'linter', 'SKILL.md'),
      '---\nname: linter\ndescription: Linter\n---\n'
    );

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

    const lines: string[] = [];
    const groups = byCategory['custom'] || {};
    const ungrouped = ungroupedByCategory['custom'] || [];

    for (const [groupId, skillNames] of Object.entries(groups)) {
      lines.push(`  ${groupId} (${skillNames.length})`);
    }

    for (const name of ungrouped) {
      lines.push(`  ${name}`);
    }

    expect(lines).not.toContainEqual(expect.stringContaining('(ungrouped)'));
    expect(lines.findIndex((l) => l.includes('my-tools'))).toBeLessThan(
      lines.findIndex((l) => l.includes('tool-a'))
    );
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

describe('renderAvailableBody virtual groups', () => {
  const skill = (source: string, name: string): SkillInfo => ({
    name,
    description: '',
    path: `/skills/${source}/${name}`,
    source,
  });

  const noCollections = new Map<string, string[]>();

  const subgroupHeader = (lines: string[], label: string): number =>
    lines.findIndex((l) => l === `  ${label}`);

  it('renders virtual group as a subheading with members indented under it', () => {
    const skills = [
      skill('custom', 'jt-code-reviewer'),
      skill('custom', 'jt-share'),
    ];
    const virtual = new Map<string, string[]>([
      ['custom/jt-code-reviewer', ['develop']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    const headerIdx = lines.findIndex((l) => l === '  develop (1)');
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(lines[headerIdx + 1]).toBe('    jt-code-reviewer');
  });

  it('removes virtual group members from the flat custom list', () => {
    const skills = [
      skill('custom', 'jt-code-reviewer'),
      skill('custom', 'jt-share'),
    ];
    const virtual = new Map<string, string[]>([
      ['custom/jt-code-reviewer', ['develop']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    expect(lines).toContain('    jt-code-reviewer');
    expect(lines).not.toContain('  jt-code-reviewer');
    expect(lines).toContain('  jt-share');
  });

  it('orders physical subgroup before virtual group subgroup', () => {
    const skills = [
      skill('custom/openspec', 'apply'),
      skill('custom', 'jt-code-reviewer'),
    ];
    const virtual = new Map<string, string[]>([
      ['custom/jt-code-reviewer', ['develop']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    expect(subgroupHeader(lines, 'openspec (1)')).toBeLessThan(
      subgroupHeader(lines, 'develop (1)'),
    );
  });

  it('lists a skill once under each virtual group it belongs to', () => {
    const skills = [skill('custom', 'jt-codex')];
    const virtual = new Map<string, string[]>([
      ['custom/jt-codex', ['develop', 'tools']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    const developIdx = lines.findIndex((l) => l === '  develop (1)');
    const toolsIdx = lines.findIndex((l) => l === '  tools (1)');
    expect(developIdx).toBeGreaterThanOrEqual(0);
    expect(toolsIdx).toBeGreaterThanOrEqual(0);
    expect(lines[developIdx + 1]).toBe('    jt-codex');
    expect(lines[toolsIdx + 1]).toBe('    jt-codex');
    expect(lines.filter((l) => l.trim() === 'jt-codex')).toHaveLength(2);
  });

  it('groups cross-category virtual members within their own category block', () => {
    const skills = [
      skill('custom', 'jt-codex'),
      skill('registry', 'pkg-skill'),
    ];
    const virtual = new Map<string, string[]>([
      ['custom/jt-codex', ['shared']],
      ['registry/pkg-skill', ['shared']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    const customHeaderIdx = lines.findIndex((l) => l.startsWith('── custom'));
    const registryHeaderIdx = lines.findIndex((l) => l.startsWith('── registry'));
    const sharedIndices = lines
      .map((l, i) => (l === '  shared (1)' ? i : -1))
      .filter((i) => i >= 0);

    expect(sharedIndices).toHaveLength(2);
    const customShared = sharedIndices.find((i) => i > customHeaderIdx && i < registryHeaderIdx);
    const registryShared = sharedIndices.find((i) => i > registryHeaderIdx);
    expect(customShared).toBeDefined();
    expect(registryShared).toBeDefined();
    expect(lines[(customShared as number) + 1]).toBe('    jt-codex');
    expect(lines[(registryShared as number) + 1]).toBe('    pkg-skill');
  });

  it('skips dangling members and counts only resolved members', () => {
    const skills = [skill('custom', 'jt-code-reviewer')];
    const virtual = new Map<string, string[]>([
      ['custom/jt-code-reviewer', ['develop']],
      ['custom/not-installed', ['develop']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    expect(lines).toContain('  develop (1)');
    expect(lines).not.toContain('    not-installed');
    expect(lines).not.toContain('  not-installed');
  });

  it('produces identical output to source-path grouping when no virtual groups exist', () => {
    const skills = [
      skill('official/anthropic/skills', 'code-review'),
      skill('custom/openspec', 'apply'),
      skill('custom', 'jt-share'),
    ];

    const lines = renderAvailableBody(skills, noCollections, new Map());

    expect(lines).toContain('── official (1 skill) ──');
    expect(lines).toContain('  anthropic/skills (1)');
    expect(lines).toContain('    code-review');
    expect(lines).toContain('── custom (2 skills) ──');
    expect(lines).toContain('  openspec (1)');
    expect(lines).toContain('    apply');
    expect(lines).toContain('  jt-share');
    expect(lines.some((l) => l.includes('develop'))).toBe(false);
  });

  it('keeps category header count as distinct skills while subgroup count is shown members', () => {
    const skills = [skill('custom', 'jt-codex')];
    const virtual = new Map<string, string[]>([
      ['custom/jt-codex', ['develop', 'tools']],
    ]);

    const lines = renderAvailableBody(skills, noCollections, virtual);

    expect(lines).toContain('── custom (1 skill) ──');
    expect(lines).toContain('  develop (1)');
    expect(lines).toContain('  tools (1)');
  });
});

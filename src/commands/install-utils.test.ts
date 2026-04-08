import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { selectSkills, findInstalledCustomSkill, findInstalledCustomSkills, findCustomSkillByKey } from './install-utils.js';
import type { InstallableSkill } from './install-utils.js';
import * as constants from '../constants.js';

vi.mock('../utils/prompts.js', () => ({
  promptSkillsToInstall: vi.fn().mockResolvedValue({ names: [], isAll: false }),
  promptConfirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/sources.js', () => ({
  SourcesService: vi.fn().mockImplementation(() => ({
    getAllSources: vi.fn().mockReturnValue({}),
    addSource: vi.fn(),
    removeSource: vi.fn(),
  })),
}));

const { promptSkillsToInstall } = await import('../utils/prompts.js');

describe('selectSkills with --skill flag', () => {
  const skills: InstallableSkill[] = [
    { name: 'skill-a', description: 'A', path: '/a' },
    { name: 'skill-b', description: 'B', path: '/b' },
    { name: 'skill-c', description: 'C', path: '/c' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  it('filters by --skill when provided', async () => {
    const result = await selectSkills(skills, { skill: ['skill-a', 'skill-c'] });

    expect(result).toEqual({
      skills: [
        { name: 'skill-a', description: 'A', path: '/a' },
        { name: 'skill-c', description: 'C', path: '/c' },
      ],
      isAll: false,
    });
    expect(promptSkillsToInstall).not.toHaveBeenCalled();
  });

  it('exits when --skill specifies nonexistent skill', async () => {
    await expect(
      selectSkills(skills, { skill: ['nonexistent'] })
    ).rejects.toThrow('process.exit');

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('--skill takes precedence over --all', async () => {
    const result = await selectSkills(skills, { all: true, skill: ['skill-a'] });

    expect(result).toEqual({
      skills: [{ name: 'skill-a', description: 'A', path: '/a' }],
      isAll: false,
    });
  });

  it('falls back to interactive when --skill is empty array', async () => {
    vi.mocked(promptSkillsToInstall).mockResolvedValue({
      names: ['skill-b'],
      isAll: false,
    });

    const result = await selectSkills(skills, { skill: [] });

    expect(promptSkillsToInstall).toHaveBeenCalled();
    expect(result).toEqual({
      skills: [{ name: 'skill-b', description: 'B', path: '/b' }],
      isAll: false,
    });
  });
});

describe('selectSkills selection mode semantics', () => {
  const skills: InstallableSkill[] = [
    { name: 'skill-a', description: 'A', path: '/a' },
    { name: 'skill-b', description: 'B', path: '/b' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isAll true for --all', async () => {
    const result = await selectSkills(skills, { all: true });

    expect(result).toEqual({
      skills,
      isAll: true,
    });
  });

  it('returns isAll true when there is only one selectable skill', async () => {
    const result = await selectSkills([skills[0]], {});

    expect(result).toEqual({
      skills: [skills[0]],
      isAll: true,
    });
  });

  it('returns empty with isAll false when everything is already installed', async () => {
    const result = await selectSkills(skills, {}, new Set(['skill-a', 'skill-b']));

    expect(result).toEqual({
      skills: [],
      isAll: false,
    });
  });

  it('passes through interactive isAll results', async () => {
    vi.mocked(promptSkillsToInstall).mockResolvedValueOnce({
      names: ['skill-a', 'skill-b'],
      isAll: true,
    });

    const result = await selectSkills(skills, {}, new Set(['installed-only']));

    expect(result).toEqual({
      skills,
      isAll: true,
    });
  });
});

describe('findInstalledCustomSkill', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-lookup-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
  });

  it('finds skill in direct subdirectory', () => {
    const skillDir = join(testManagerDir, 'custom', 'jt-release');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: jt-release\n---\n');

    const result = findInstalledCustomSkill('jt-release');
    expect(result).toEqual({ key: 'custom/jt-release', path: skillDir });
  });

  it('returns null when skill not found', () => {
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });

    const result = findInstalledCustomSkill('unknown-skill');
    expect(result).toBeNull();
  });

  it('finds skill in nested subdirectory', () => {
    const groupedDir = join(testManagerDir, 'custom', 'group-a', 'foo');
    mkdirSync(groupedDir, { recursive: true });
    writeFileSync(join(groupedDir, 'SKILL.md'), '---\nname: foo\n---\n');

    const result = findInstalledCustomSkill('foo');
    expect(result).toEqual({ key: 'custom/group-a/foo', path: groupedDir });
  });

  it('returns null when custom directory does not exist', () => {
    const result = findInstalledCustomSkill('any-skill');
    expect(result).toBeNull();
  });

  it('does not scan subdirectories of skill directories', () => {
    const skillDir = join(testManagerDir, 'custom', 'openspec');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: openspec\n---\n');

    const nestedDir = join(skillDir, 'nested-skill');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'SKILL.md'), '---\nname: nested-skill\n---\n');

    const result = findInstalledCustomSkill('nested-skill');
    expect(result).toBeNull();
  });

  it('prefers direct path over nested path', () => {
    const directDir = join(testManagerDir, 'custom', 'my-skill');
    mkdirSync(directDir, { recursive: true });
    writeFileSync(join(directDir, 'SKILL.md'), '---\nname: my-skill\n---\n');

    const nestedDir = join(testManagerDir, 'custom', 'group-b', 'my-skill');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'SKILL.md'), '---\nname: my-skill\n---\n');

    const result = findInstalledCustomSkill('my-skill');
    expect(result).toEqual({ key: 'custom/my-skill', path: directDir });
  });

  it('finds skill across multiple group subdirectories', () => {
    mkdirSync(join(testManagerDir, 'custom', 'group-a'), { recursive: true });
    const groupBDir = join(testManagerDir, 'custom', 'group-b', 'bar');
    mkdirSync(groupBDir, { recursive: true });
    writeFileSync(join(groupBDir, 'SKILL.md'), '---\nname: bar\n---\n');

    const result = findInstalledCustomSkill('bar');
    expect(result).toEqual({ key: 'custom/group-b/bar', path: groupBDir });
  });
});

describe('findInstalledCustomSkills', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-lookup-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
  });

  it('returns empty array when no matches', () => {
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });
    const result = findInstalledCustomSkills('unknown');
    expect(result).toEqual([]);
  });

  it('returns single result for top-level only', () => {
    const skillDir = join(testManagerDir, 'custom', 'jt-codex');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findInstalledCustomSkills('jt-codex');
    expect(result).toEqual([{ key: 'custom/jt-codex', path: skillDir }]);
  });

  it('returns both top-level and subdirectory matches', () => {
    const directDir = join(testManagerDir, 'custom', 'jt-codex');
    mkdirSync(directDir, { recursive: true });
    writeFileSync(join(directDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const nestedDir = join(testManagerDir, 'custom', 'develop', 'jt-codex');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findInstalledCustomSkills('jt-codex');
    expect(result).toEqual([
      { key: 'custom/jt-codex', path: directDir },
      { key: 'custom/develop/jt-codex', path: nestedDir },
    ]);
  });

  it('returns only subdirectory match when no top-level', () => {
    const nestedDir = join(testManagerDir, 'custom', 'develop', 'jt-codex');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findInstalledCustomSkills('jt-codex');
    expect(result).toEqual([{ key: 'custom/develop/jt-codex', path: nestedDir }]);
  });

  it('returns empty when custom dir does not exist', () => {
    const result = findInstalledCustomSkills('any-skill');
    expect(result).toEqual([]);
  });
});

describe('findCustomSkillByKey', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-lookup-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
  });

  it('finds skill by full key with subdirectory', () => {
    const skillDir = join(testManagerDir, 'custom', 'develop', 'jt-codex');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findCustomSkillByKey('custom/develop/jt-codex');
    expect(result).toEqual({ key: 'custom/develop/jt-codex', path: skillDir });
  });

  it('finds skill by simple key', () => {
    const skillDir = join(testManagerDir, 'custom', 'jt-codex');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findCustomSkillByKey('custom/jt-codex');
    expect(result).toEqual({ key: 'custom/jt-codex', path: skillDir });
  });

  it('returns null for non-existent key', () => {
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });
    const result = findCustomSkillByKey('custom/develop/jt-codex');
    expect(result).toBeNull();
  });

  it('returns null for non-custom key', () => {
    const result = findCustomSkillByKey('official/anthropic/skills');
    expect(result).toBeNull();
  });
});

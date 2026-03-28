import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { selectSkills, findInstalledCustomSkill } from './install-utils.js';
import type { InstallableSkill } from './install-utils.js';
import * as constants from '../constants.js';

vi.mock('../utils/prompts.js', () => ({
  promptSkillsToInstall: vi.fn().mockResolvedValue([]),
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

    expect(result).toEqual([
      { name: 'skill-a', description: 'A', path: '/a' },
      { name: 'skill-c', description: 'C', path: '/c' },
    ]);
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

    expect(result).toEqual([{ name: 'skill-a', description: 'A', path: '/a' }]);
  });

  it('falls back to interactive when --skill is empty array', async () => {
    vi.mocked(promptSkillsToInstall).mockResolvedValue(['skill-b']);

    const result = await selectSkills(skills, { skill: [] });

    expect(promptSkillsToInstall).toHaveBeenCalled();
    expect(result).toEqual([{ name: 'skill-b', description: 'B', path: '/b' }]);
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

  it('finds skill in group subdirectory', () => {
    const skillDir = join(testManagerDir, 'custom', 'my-group', 'jt-codex');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: jt-codex\n---\n');

    const result = findInstalledCustomSkill('jt-codex');
    expect(result).toEqual({ key: 'custom/my-group/jt-codex', path: skillDir });
  });

  it('returns null when skill not found', () => {
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });

    const result = findInstalledCustomSkill('unknown-skill');
    expect(result).toBeNull();
  });

  it('prefers direct subdirectory over group subdirectory', () => {
    const directDir = join(testManagerDir, 'custom', 'foo');
    mkdirSync(directDir, { recursive: true });
    writeFileSync(join(directDir, 'SKILL.md'), '---\nname: foo\n---\n');

    const groupedDir = join(testManagerDir, 'custom', 'group-a', 'foo');
    mkdirSync(groupedDir, { recursive: true });
    writeFileSync(join(groupedDir, 'SKILL.md'), '---\nname: foo\n---\n');

    const result = findInstalledCustomSkill('foo');
    expect(result).toEqual({ key: 'custom/foo', path: directDir });
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
});

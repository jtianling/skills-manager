import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectSkills } from './install-utils.js';
import type { InstallableSkill } from './install-utils.js';

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

  it('--all takes precedence over --skill', async () => {
    const result = await selectSkills(skills, { all: true, skill: ['skill-a'] });

    expect(result).toEqual(skills);
  });

  it('falls back to interactive when --skill is empty array', async () => {
    vi.mocked(promptSkillsToInstall).mockResolvedValue(['skill-b']);

    const result = await selectSkills(skills, { skill: [] });

    expect(promptSkillsToInstall).toHaveBeenCalled();
    expect(result).toEqual([{ name: 'skill-b', description: 'B', path: '/b' }]);
  });
});

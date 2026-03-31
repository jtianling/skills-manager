import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSkillByName } from './skill-resolve.js';
import type { SkillInfo } from '../types.js';

vi.mock('./prompts.js', () => ({
  promptSelect: vi.fn(),
}));

const { promptSelect } = await import('./prompts.js');

const allSkills: SkillInfo[] = [
  { name: 'jt-codex', description: '', path: '/custom/jt-codex', source: 'custom' },
  { name: 'jt-codex', description: '', path: '/custom/develop/jt-codex', source: 'custom/develop' },
  { name: 'jt-release', description: '', path: '/custom/jt-release', source: 'custom' },
  { name: 'commit', description: '', path: '/official/anthropic/skills/commit', source: 'official/anthropic/skills' },
];

describe('resolveSkillByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no match', async () => {
    const result = await resolveSkillByName('unknown-skill', allSkills);
    expect(result).toBeNull();
  });

  it('returns directly when unique bare name match', async () => {
    const result = await resolveSkillByName('jt-release', allSkills);
    expect(result).toEqual(allSkills[2]);
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it('prompts selection when multiple bare name matches', async () => {
    vi.mocked(promptSelect).mockResolvedValue('custom/develop/jt-codex');
    const result = await resolveSkillByName('jt-codex', allSkills);
    expect(result).toEqual(allSkills[1]);
    expect(promptSelect).toHaveBeenCalledWith('Which one?', [
      { name: 'custom/jt-codex', value: 'custom/jt-codex' },
      { name: 'custom/develop/jt-codex', value: 'custom/develop/jt-codex' },
    ]);
  });

  it('returns exact match for full key', async () => {
    const result = await resolveSkillByName('custom/develop/jt-codex', allSkills);
    expect(result).toEqual(allSkills[1]);
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it('returns exact match for official full key', async () => {
    const result = await resolveSkillByName('official/anthropic/skills/commit', allSkills);
    expect(result).toEqual(allSkills[3]);
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it('full key takes priority over bare name search', async () => {
    const result = await resolveSkillByName('custom/jt-codex', allSkills);
    expect(result).toEqual(allSkills[0]);
    expect(promptSelect).not.toHaveBeenCalled();
  });
});

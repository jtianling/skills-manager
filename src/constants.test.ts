import { describe, it, expect } from 'vitest';
import { OFFICIAL_PROVIDERS, findOfficialProvider } from './constants.js';

describe('OFFICIAL_PROVIDERS', () => {
  it('contains all initial providers', () => {
    expect(OFFICIAL_PROVIDERS).toHaveProperty('anthropic');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('openai');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('microsoft');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('vercel-labs');
  });

  it('anthropic maps to anthropics/skills', () => {
    expect(OFFICIAL_PROVIDERS['anthropic']).toEqual({
      owner: 'anthropics',
      repo: 'skills',
    });
  });

  it('microsoft has custom skillsPath', () => {
    expect(OFFICIAL_PROVIDERS['microsoft'].skillsPath).toBe('.github/skills');
  });

  it('vercel-labs maps to vercel-labs/agent-skills', () => {
    expect(OFFICIAL_PROVIDERS['vercel-labs']).toEqual({
      owner: 'vercel-labs',
      repo: 'agent-skills',
    });
  });
});

describe('findOfficialProvider', () => {
  it('returns key for matching owner/repo', () => {
    expect(findOfficialProvider('anthropics', 'skills')).toBe('anthropic');
    expect(findOfficialProvider('openai', 'skills')).toBe('openai');
    expect(findOfficialProvider('microsoft', 'skills')).toBe('microsoft');
    expect(findOfficialProvider('vercel-labs', 'agent-skills')).toBe('vercel-labs');
  });

  it('returns null for non-official owner/repo', () => {
    expect(findOfficialProvider('obra', 'superpowers')).toBeNull();
    expect(findOfficialProvider('random-user', 'skills')).toBeNull();
  });

  it('returns null for partial matches', () => {
    expect(findOfficialProvider('anthropics', 'other-repo')).toBeNull();
    expect(findOfficialProvider('other-owner', 'skills')).toBeNull();
  });
});

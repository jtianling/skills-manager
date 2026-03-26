import { describe, it, expect } from 'vitest';
import { OFFICIAL_PROVIDERS, findOfficialProvider, resolveProviderAlias } from './constants.js';

describe('OFFICIAL_PROVIDERS', () => {
  it('contains all initial providers', () => {
    expect(OFFICIAL_PROVIDERS).toHaveProperty('anthropic');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('openai');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('microsoft');
    expect(OFFICIAL_PROVIDERS).toHaveProperty('vercel-labs');
  });

  it('anthropic maps to anthropics with skills repo', () => {
    const provider = OFFICIAL_PROVIDERS['anthropic'];
    expect(provider.owner).toBe('anthropics');
    expect(provider.repos).toEqual([{ repo: 'skills' }]);
  });

  it('microsoft has custom skillsPath', () => {
    const provider = OFFICIAL_PROVIDERS['microsoft'];
    expect(provider.repos[0].skillsPath).toBe('.github/skills');
  });

  it('vercel-labs has multiple repos and aliases', () => {
    const provider = OFFICIAL_PROVIDERS['vercel-labs'];
    expect(provider.owner).toBe('vercel-labs');
    expect(provider.repos).toEqual([
      { repo: 'agent-skills' },
      { repo: 'agent-browser' },
    ]);
    expect(provider.aliases).toEqual(['vercel']);
  });
});

describe('findOfficialProvider', () => {
  it('returns OfficialMatch with exactRepoMatch=true for matching owner+repo', () => {
    expect(findOfficialProvider('anthropics', 'skills')).toEqual({
      providerKey: 'anthropic',
      exactRepoMatch: true,
    });
    expect(findOfficialProvider('openai', 'skills')).toEqual({
      providerKey: 'openai',
      exactRepoMatch: true,
    });
    expect(findOfficialProvider('vercel-labs', 'agent-skills')).toEqual({
      providerKey: 'vercel-labs',
      exactRepoMatch: true,
    });
    expect(findOfficialProvider('vercel-labs', 'agent-browser')).toEqual({
      providerKey: 'vercel-labs',
      exactRepoMatch: true,
    });
  });

  it('returns OfficialMatch with exactRepoMatch=false for matching owner but unknown repo', () => {
    expect(findOfficialProvider('anthropics', 'other-repo')).toEqual({
      providerKey: 'anthropic',
      exactRepoMatch: false,
    });
    expect(findOfficialProvider('vercel-labs', 'unknown-new-repo')).toEqual({
      providerKey: 'vercel-labs',
      exactRepoMatch: false,
    });
  });

  it('returns null for non-official owner', () => {
    expect(findOfficialProvider('obra', 'superpowers')).toBeNull();
    expect(findOfficialProvider('random-user', 'skills')).toBeNull();
  });
});

describe('resolveProviderAlias', () => {
  it('returns provider key for matching alias', () => {
    expect(resolveProviderAlias('vercel')).toBe('vercel-labs');
  });

  it('returns null for non-matching alias', () => {
    expect(resolveProviderAlias('unknown')).toBeNull();
  });

  it('returns null for direct provider key (not an alias)', () => {
    expect(resolveProviderAlias('vercel-labs')).toBeNull();
    expect(resolveProviderAlias('anthropic')).toBeNull();
  });
});

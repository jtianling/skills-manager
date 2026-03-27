import { describe, it, expect } from 'vitest';
import { OFFICIAL_OWNERS, findOfficialProvider } from './constants.js';

describe('OFFICIAL_OWNERS', () => {
  it('contains all initial providers', () => {
    expect(OFFICIAL_OWNERS).toHaveProperty('anthropic');
    expect(OFFICIAL_OWNERS).toHaveProperty('openai');
    expect(OFFICIAL_OWNERS).toHaveProperty('microsoft');
    expect(OFFICIAL_OWNERS).toHaveProperty('vercel-labs');
  });

  it('maps provider keys to GitHub owners', () => {
    expect(OFFICIAL_OWNERS['anthropic']).toBe('anthropics');
    expect(OFFICIAL_OWNERS['openai']).toBe('openai');
    expect(OFFICIAL_OWNERS['microsoft']).toBe('microsoft');
    expect(OFFICIAL_OWNERS['vercel-labs']).toBe('vercel-labs');
  });
});

describe('findOfficialProvider', () => {
  it('returns provider key for official owners', () => {
    expect(findOfficialProvider('anthropics')).toBe('anthropic');
    expect(findOfficialProvider('openai')).toBe('openai');
    expect(findOfficialProvider('microsoft')).toBe('microsoft');
    expect(findOfficialProvider('vercel-labs')).toBe('vercel-labs');
  });

  it('returns null for non-official owner', () => {
    expect(findOfficialProvider('obra')).toBeNull();
    expect(findOfficialProvider('random-user')).toBeNull();
  });
});

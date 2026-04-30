import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDependencyAvailability,
  handleUnavailableDeps,
  normalizePackageScope,
  type UnavailableDep,
} from './publish.js';

// vi.hoisted so the mock fn is available when vi.mock is hoisted
const { mockGetPackument } = vi.hoisted(() => ({
  mockGetPackument: vi.fn(async (name: string) => {
    if (name === 'existing-pkg') {
      return { name: 'existing-pkg', 'dist-tags': { latest: '1.0.0' }, versions: {} };
    }
    throw new Error(`Package "${name}" not found in registry`);
  }),
}));

vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    getPackument: mockGetPackument,
    publish: vi.fn(async () => ({ ok: true })),
  })),
}));

// Mock prompts
vi.mock('../utils/prompts.js', () => ({
  promptSelect: vi.fn(),
  promptConfirm: vi.fn(),
}));

import { promptSelect } from '../utils/prompts.js';
const mockPromptSelect = vi.mocked(promptSelect);

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default getPackument behavior after clearAllMocks wipes it
  mockGetPackument.mockImplementation(async (name: string) => {
    if (name === 'existing-pkg') {
      return { name: 'existing-pkg', 'dist-tags': { latest: '1.0.0' }, versions: {} };
    }
    throw new Error(`Package "${name}" not found in registry`);
  });
});

describe('checkDependencyAvailability', () => {
  it('returns empty array when all registry deps are available', async () => {
    const result = await checkDependencyAvailability(['existing-pkg']);
    expect(result).toHaveLength(0);
  });

  it('returns unavailable registry deps', async () => {
    const result = await checkDependencyAvailability(['missing-pkg']);
    expect(result).toHaveLength(1);
    expect(result[0].identifier).toBe('missing-pkg');
    expect(result[0].parsed.type).toBe('registry');
  });

  it('marks GitHub deps as unavailable', async () => {
    const result = await checkDependencyAvailability(['owner/repo:skill']);
    expect(result).toHaveLength(1);
    expect(result[0].parsed.type).toBe('github-skill');
  });

  it('marks GitHub repo deps as unavailable', async () => {
    const result = await checkDependencyAvailability(['owner/repo']);
    expect(result).toHaveLength(1);
    expect(result[0].parsed.type).toBe('github-repo');
  });

  it('handles mix of available and unavailable deps', async () => {
    const result = await checkDependencyAvailability(['existing-pkg', 'missing-pkg', 'owner/repo']);
    expect(result).toHaveLength(2);
    expect(result.map(d => d.identifier)).toEqual(['missing-pkg', 'owner/repo']);
  });

  it('rethrows non-404 errors (network/server failures)', async () => {
    mockGetPackument.mockRejectedValueOnce(
      new Error('Failed to fetch package "server-pkg": 500 Internal Server Error'),
    );

    await expect(checkDependencyAvailability(['server-pkg'])).rejects.toThrow('500 Internal Server Error');
  });
});

describe('handleUnavailableDeps', () => {
  const manifest = {
    name: 'my-skill',
    version: '1.0.0',
    description: 'test',
    dependencies: ['missing-pkg', 'owner/repo:helper'],
  };
  const token = 'test-token';

  it('returns proceed=false when user cancels', async () => {
    const unavailable: UnavailableDep[] = [{
      identifier: 'missing-pkg',
      parsed: { type: 'registry', packageName: 'missing-pkg' },
    }];

    mockPromptSelect.mockResolvedValueOnce('cancel' as never);

    const result = await handleUnavailableDeps(unavailable, manifest, token);
    expect(result.proceed).toBe(false);
  });

  it('removes dep when user chooses skip', async () => {
    const unavailable: UnavailableDep[] = [{
      identifier: 'missing-pkg',
      parsed: { type: 'registry', packageName: 'missing-pkg' },
    }];

    mockPromptSelect.mockResolvedValueOnce('skip' as never);

    const result = await handleUnavailableDeps(unavailable, manifest, token);
    expect(result.proceed).toBe(true);
    expect(result.updatedDependencies).not.toContain('missing-pkg');
    expect(result.updatedDependencies).toContain('owner/repo:helper');
  });

  it('returns proceed=false when cascade publish fails (needs manual publish)', async () => {
    const unavailable: UnavailableDep[] = [{
      identifier: 'owner/repo:helper',
      parsed: { type: 'github-skill', owner: 'owner', repo: 'repo', skillName: 'helper' },
    }];

    mockPromptSelect.mockResolvedValueOnce('publish-together' as never);

    const result = await handleUnavailableDeps(unavailable, manifest, token);
    expect(result.proceed).toBe(false);
    // Dependency should NOT be removed — user must publish manually first
    expect(result.updatedDependencies).toContain('owner/repo:helper');
  });
});

describe('normalizePackageScope', () => {
  it('prepends user scope to bare package name', () => {
    const result = normalizePackageScope('write-lyric', 'alice');
    expect(result).toEqual({ name: '@alice/write-lyric', rewrote: true });
  });

  it('keeps name as-is when scope matches user', () => {
    const result = normalizePackageScope('@alice/write-lyric', 'alice');
    expect(result).toEqual({ name: '@alice/write-lyric', rewrote: false });
  });

  it('throws when scope does not match logged-in user', () => {
    expect(() => normalizePackageScope('@bob/skill', 'alice')).toThrow(
      'scope "@bob" does not match logged-in user "@alice"',
    );
  });

  it('suggests the corrected name in the error message', () => {
    expect(() => normalizePackageScope('@bob/skill', 'alice')).toThrow(
      '@alice/skill',
    );
  });

  it('throws on malformed scoped name without slash', () => {
    expect(() => normalizePackageScope('@brokenname', 'alice')).toThrow(
      'Invalid scoped package name',
    );
  });
});

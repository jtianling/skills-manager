import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkDependencyAvailability, handleUnavailableDeps, type UnavailableDep } from './publish.js';

// Mock registry service
vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    getPackument: vi.fn(async (name: string) => {
      if (name === 'existing-pkg') {
        return { name: 'existing-pkg', 'dist-tags': { latest: '1.0.0' }, versions: {} };
      }
      throw new Error(`Package "${name}" not found in registry`);
    }),
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

  it('proceeds with cascade publish attempt for GitHub deps', async () => {
    const unavailable: UnavailableDep[] = [{
      identifier: 'owner/repo:helper',
      parsed: { type: 'github-skill', owner: 'owner', repo: 'repo', skillName: 'helper' },
    }];

    mockPromptSelect.mockResolvedValueOnce('publish-together' as never);

    const result = await handleUnavailableDeps(unavailable, manifest, token);
    expect(result.proceed).toBe(true);
    // GitHub cascade publish currently returns null (needs manual publish),
    // so the dep gets removed
    expect(result.updatedDependencies).not.toContain('owner/repo:helper');
  });
});

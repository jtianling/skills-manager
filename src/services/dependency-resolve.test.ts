import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDependencies, isDependencyInstalled, type ResolveOptions } from './dependency.js';

// Mock fs to control isDependencyInstalled
vi.mock('../utils/fs.js', () => ({
  fileExists: vi.fn(() => false),
  readFileContent: vi.fn(() => ''),
}));

import { fileExists } from '../utils/fs.js';
const mockFileExists = vi.mocked(fileExists);

function createMockOptions(overrides?: Partial<ResolveOptions>): ResolveOptions {
  return {
    installRegistryDep: vi.fn(async () => []),
    installGitHubRepoDep: vi.fn(async () => {}),
    installGitHubSkillDep: vi.fn(async () => {}),
    readInstalledManifest: vi.fn(() => null),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFileExists.mockReturnValue(false);
});

describe('resolveDependencies', () => {
  it('installs registry dependencies', async () => {
    const opts = createMockOptions();
    await resolveDependencies(['base-prompts'], 'my-skill', opts);
    expect(opts.installRegistryDep).toHaveBeenCalledWith('base-prompts');
  });

  it('installs github-repo dependencies', async () => {
    const opts = createMockOptions();
    await resolveDependencies(['obra/superpowers'], 'my-skill', opts);
    expect(opts.installGitHubRepoDep).toHaveBeenCalledWith('obra', 'superpowers');
  });

  it('installs github-skill dependencies', async () => {
    const opts = createMockOptions();
    await resolveDependencies(['anthropics/skills:git-helper'], 'my-skill', opts);
    expect(opts.installGitHubSkillDep).toHaveBeenCalledWith('anthropics', 'skills', 'git-helper');
  });

  it('skips already installed dependencies', async () => {
    mockFileExists.mockReturnValue(true);
    const opts = createMockOptions();
    await resolveDependencies(['base-prompts'], 'my-skill', opts);
    expect(opts.installRegistryDep).not.toHaveBeenCalled();
  });

  it('detects circular dependencies', async () => {
    const installing = new Set(['a', 'b']);
    const opts = createMockOptions();
    await expect(
      resolveDependencies(['a'], 'c', opts, installing)
    ).rejects.toThrow('Circular dependency detected');
  });

  it('throws on max depth exceeded', async () => {
    const opts = createMockOptions();
    await expect(
      resolveDependencies(['x'], 'y', opts, new Set(), 11)
    ).rejects.toThrow('Dependency chain too deep (max 10 levels)');
  });

  it('recursively resolves sub-dependencies', async () => {
    const opts = createMockOptions({
      readInstalledManifest: vi.fn((dep) => {
        if (dep.type === 'registry' && dep.packageName === 'dep-a') {
          return {
            name: 'dep-a',
            version: '1.0.0',
            description: 'Dep A',
            dependencies: ['dep-b'],
          };
        }
        return null;
      }),
    });

    await resolveDependencies(['dep-a'], 'root', opts);
    expect(opts.installRegistryDep).toHaveBeenCalledWith('dep-a');
    expect(opts.installRegistryDep).toHaveBeenCalledWith('dep-b');
  });

  it('handles empty dependencies array', async () => {
    const opts = createMockOptions();
    await resolveDependencies([], 'my-skill', opts);
    expect(opts.installRegistryDep).not.toHaveBeenCalled();
  });

  it('continues when a dependency install fails', async () => {
    const opts = createMockOptions({
      installRegistryDep: vi.fn(async (name) => {
        if (name === 'fail-dep') throw new Error('not found');
        return [];
      }),
    });

    // Should not throw
    await resolveDependencies(['fail-dep', 'ok-dep'], 'my-skill', opts);
    expect(opts.installRegistryDep).toHaveBeenCalledWith('fail-dep');
    expect(opts.installRegistryDep).toHaveBeenCalledWith('ok-dep');
  });
});

describe('isDependencyInstalled', () => {
  it('checks registry path for registry deps', () => {
    mockFileExists.mockReturnValue(false);
    expect(isDependencyInstalled({ type: 'registry', packageName: 'foo' })).toBe(false);

    mockFileExists.mockReturnValue(true);
    expect(isDependencyInstalled({ type: 'registry', packageName: 'foo' })).toBe(true);
  });

  it('checks community/official paths for github-repo deps', () => {
    mockFileExists.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(isDependencyInstalled({ type: 'github-repo', owner: 'o', repo: 'r' })).toBe(true);
  });

  it('checks community/official paths for github-skill deps', () => {
    mockFileExists.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(isDependencyInstalled({ type: 'github-skill', owner: 'o', repo: 'r', skillName: 's' })).toBe(true);
  });
});

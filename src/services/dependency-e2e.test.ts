import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDependencies, parseDependencyIdentifier, type ResolveOptions } from './dependency.js';
import { checkDependencyAvailability } from '../commands/publish.js';

// Mock fs
vi.mock('../utils/fs.js', () => ({
  fileExists: vi.fn(() => false),
  readFileContent: vi.fn(() => ''),
}));

// Mock registry service for publish tests
vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    getPackument: vi.fn(async (name: string) => {
      if (name === 'available-dep') {
        return { name: 'available-dep', 'dist-tags': { latest: '1.0.0' }, versions: {} };
      }
      throw new Error(`Package "${name}" not found in registry`);
    }),
    publish: vi.fn(async () => ({ ok: true })),
  })),
}));

import { fileExists } from '../utils/fs.js';
const mockFileExists = vi.mocked(fileExists);

beforeEach(() => {
  vi.clearAllMocks();
  mockFileExists.mockReturnValue(false);
});

function createMockOptions(overrides?: Partial<ResolveOptions>): ResolveOptions {
  return {
    installRegistryDep: vi.fn(async () => []),
    installGitHubRepoDep: vi.fn(async () => {}),
    installGitHubSkillDep: vi.fn(async () => {}),
    readInstalledManifest: vi.fn(() => null),
    ...overrides,
  };
}

describe('E2E: install registry skill with dependencies', () => {
  it('resolves transitive dependencies A → B → C', async () => {
    const installOrder: string[] = [];

    const opts = createMockOptions({
      installRegistryDep: vi.fn(async (name) => {
        installOrder.push(name);
        return [];
      }),
      readInstalledManifest: vi.fn((dep) => {
        if (dep.type === 'registry') {
          if (dep.packageName === 'skill-a') {
            return { name: 'skill-a', version: '1.0.0', description: 'A', dependencies: ['skill-b'] };
          }
          if (dep.packageName === 'skill-b') {
            return { name: 'skill-b', version: '1.0.0', description: 'B', dependencies: ['skill-c'] };
          }
        }
        return null;
      }),
    });

    await resolveDependencies(['skill-a'], 'root-skill', opts);

    expect(installOrder).toEqual(['skill-a', 'skill-b', 'skill-c']);
  });

  it('handles mixed dependency types (registry + GitHub)', async () => {
    const opts = createMockOptions({
      readInstalledManifest: vi.fn(() => null),
    });

    await resolveDependencies(
      ['base-prompts', 'anthropics/skills:code-review', 'obra/superpowers'],
      'my-skill',
      opts,
    );

    expect(opts.installRegistryDep).toHaveBeenCalledWith('base-prompts');
    expect(opts.installGitHubSkillDep).toHaveBeenCalledWith('anthropics', 'skills', 'code-review');
    expect(opts.installGitHubRepoDep).toHaveBeenCalledWith('obra', 'superpowers');
  });

  it('skips already installed deps and installs missing ones', async () => {
    // First call: skill-a registry check → not installed
    // Second call: skill-b registry check → installed (returns true)
    mockFileExists
      .mockReturnValueOnce(false)  // skill-a not installed
      .mockReturnValueOnce(true);  // skill-b installed

    const opts = createMockOptions();

    await resolveDependencies(['skill-a', 'skill-b'], 'root', opts);

    expect(opts.installRegistryDep).toHaveBeenCalledWith('skill-a');
    expect(opts.installRegistryDep).not.toHaveBeenCalledWith('skill-b');
  });
});

describe('E2E: circular dependency detection', () => {
  it('detects direct circular dependency A → B → A', async () => {
    const opts = createMockOptions({
      readInstalledManifest: vi.fn((dep) => {
        if (dep.type === 'registry' && dep.packageName === 'a') {
          return { name: 'a', version: '1.0.0', description: 'A', dependencies: ['b'] };
        }
        if (dep.type === 'registry' && dep.packageName === 'b') {
          return { name: 'b', version: '1.0.0', description: 'B', dependencies: ['a'] };
        }
        return null;
      }),
    });

    // The circular dep a→b→a should be caught.
    // Since 'a' is added to installing set, when b's dep 'a' is encountered, it detects the cycle.
    await expect(
      resolveDependencies(['a'], 'root', opts)
    ).rejects.toThrow('Circular dependency detected');
  });

  it('detects deep circular dependency A → B → C → A', async () => {
    const opts = createMockOptions({
      readInstalledManifest: vi.fn((dep) => {
        if (dep.type === 'registry') {
          const deps: Record<string, string[]> = { a: ['b'], b: ['c'], c: ['a'] };
          const d = deps[dep.packageName];
          if (d) return { name: dep.packageName, version: '1.0.0', description: '', dependencies: d };
        }
        return null;
      }),
    });

    await expect(
      resolveDependencies(['a'], 'root', opts)
    ).rejects.toThrow('Circular dependency detected');
  });

  it('allows diamond dependencies (A→B, A→C, B→D, C→D)', async () => {
    const installOrder: string[] = [];
    const installedSet = new Set<string>();

    // fileExists returns true if we've "installed" it already
    mockFileExists.mockImplementation((path: string) => {
      // Check if any installed dep matches the path
      for (const name of installedSet) {
        if (path.includes(`/registry/${name}`)) return true;
      }
      return false;
    });

    const opts = createMockOptions({
      installRegistryDep: vi.fn(async (name) => {
        installOrder.push(name);
        installedSet.add(name);
        return [];
      }),
      readInstalledManifest: vi.fn((dep) => {
        if (dep.type === 'registry') {
          const deps: Record<string, string[]> = { b: ['d'], c: ['d'] };
          const d = deps[dep.packageName];
          if (d) return { name: dep.packageName, version: '1.0.0', description: '', dependencies: d };
        }
        return null;
      }),
    });

    await resolveDependencies(['b', 'c'], 'a', opts);

    // D should be installed via b's dependency, then skipped when c tries to install it
    expect(installOrder.filter(n => n === 'b')).toHaveLength(1);
    expect(installOrder.filter(n => n === 'c')).toHaveLength(1);
    expect(installOrder.filter(n => n === 'd')).toHaveLength(1);
  });
});

describe('E2E: publish dependency check', () => {
  it('reports all available when deps exist on registry', async () => {
    const result = await checkDependencyAvailability(['available-dep']);
    expect(result).toHaveLength(0);
  });

  it('reports unavailable registry deps', async () => {
    const result = await checkDependencyAvailability(['unavailable-dep']);
    expect(result).toHaveLength(1);
    expect(result[0].identifier).toBe('unavailable-dep');
  });

  it('reports GitHub deps as unavailable on registry', async () => {
    const result = await checkDependencyAvailability([
      'available-dep',
      'owner/repo:skill-a',
      'owner/repo',
    ]);
    expect(result).toHaveLength(2);
    expect(result.map(d => d.identifier)).toEqual(['owner/repo:skill-a', 'owner/repo']);
  });
});

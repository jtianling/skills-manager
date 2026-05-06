import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockResolveCollection = vi.hoisted(() => vi.fn());
const mockInstallFromRegistry = vi.hoisted(() => vi.fn());
const mockGetToken = vi.hoisted(() => vi.fn());
const mockPromptConfirm = vi.hoisted(() => vi.fn());
const mockUpsertCollectionGroup = vi.hoisted(() => vi.fn().mockReturnValue({ created: true }));
const mockAddSkill = vi.hoisted(() => vi.fn());
const mockGroupsCtor = vi.hoisted(() => vi.fn(() => ({
  addSkill: mockAddSkill,
  getGroupKind: vi.fn().mockReturnValue('virtual'),
  upsertCollectionGroup: mockUpsertCollectionGroup,
})));

vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    resolveCollection: mockResolveCollection,
  })),
}));

vi.mock('../services/auth.js', () => ({
  getToken: mockGetToken,
}));

vi.mock('./install-registry.js', () => ({
  installFromRegistry: mockInstallFromRegistry,
}));

vi.mock('../services/groups.js', () => ({
  GroupsService: mockGroupsCtor,
  validateGroupName: vi.fn(),
}));

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: mockPromptConfirm,
}));

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import {
  executeInstallFromCollection,
  expandCollectionRefToSkillNames,
  memberToSkillName,
} from './install-collection.js';

describe('memberToSkillName', () => {
  it('strips scope from @owner/name', () => {
    expect(memberToSkillName('@alice/skill-a')).toBe('skill-a');
  });

  it('returns bare name as-is', () => {
    expect(memberToSkillName('bare-name')).toBe('bare-name');
  });
});

describe('expandCollectionRefToSkillNames', () => {
  beforeEach(() => {
    mockResolveCollection.mockReset();
    mockGetToken.mockReset().mockReturnValue(null);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns skill names and ref', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });

    const result = await expandCollectionRefToSkillNames('@alice/kit');
    expect(result).not.toBeNull();
    expect(result!.normalizedRef).toBe('@alice/kit');
    expect(result!.skillNames).toEqual(['a', 'b']);
  });

  it('returns null when collection is empty', async () => {
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });

    const result = await expandCollectionRefToSkillNames('@alice/empty');
    expect(result).toBeNull();
  });

  it('prints warnings', async () => {
    const logSpy = vi.mocked(console.log);
    mockResolveCollection.mockResolvedValueOnce({
      members: [{ packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' }],
      warnings: [{ kind: 'private-skipped', detail: '@alice/secret' }],
    });

    await expandCollectionRefToSkillNames('@alice/kit');
    const calls = logSpy.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => String(c).includes('private-skipped'))).toBe(true);
  });

  it('normalizes URL form', async () => {
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });
    await expandCollectionRefToSkillNames('https://skillsmgr.dev/c/@alice/kit');
    expect(mockResolveCollection).toHaveBeenCalledWith(
      { extends: ['@alice/kit'] },
      null,
    );
  });
});

describe('executeInstallFromCollection', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockResolveCollection.mockReset();
    mockInstallFromRegistry.mockReset();
    mockGetToken.mockReset().mockReturnValue(null);
    mockPromptConfirm.mockReset().mockResolvedValue(true);
    mockGroupsCtor.mockClear();
    mockUpsertCollectionGroup.mockReset().mockReturnValue({ created: true });
    mockAddSkill.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs all members successfully', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: '1.0.0', source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry.mockResolvedValue({ sourceKeys: [] });

    await executeInstallFromCollection('@alice/kit', { all: true });

    expect(mockInstallFromRegistry).toHaveBeenCalledTimes(2);
    expect(mockInstallFromRegistry).toHaveBeenCalledWith(
      expect.objectContaining({ packageName: '@alice/a', requestedVersion: '1.0.0' }),
      expect.any(Object),
    );
    expect(mockInstallFromRegistry).toHaveBeenCalledWith(
      expect.objectContaining({ packageName: '@alice/b', requestedVersion: undefined }),
      expect.any(Object),
    );
  });

  it('exits 0 when collection is empty', async () => {
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });

    await executeInstallFromCollection('@alice/empty', { all: true });

    expect(mockInstallFromRegistry).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('continues when one member fails', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
        { packageName: '@alice/c', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry
      .mockResolvedValueOnce({ sourceKeys: [] })
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({ sourceKeys: [] });

    await executeInstallFromCollection('@alice/kit', { all: true });

    expect(mockInstallFromRegistry).toHaveBeenCalledTimes(3);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits 1 when all members fail', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry.mockRejectedValue(new Error('network'));

    await expect(
      executeInstallFromCollection('@alice/kit', { all: true }),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('attaches token when authenticated', async () => {
    mockGetToken.mockReturnValue('spm_xyz');
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });

    await executeInstallFromCollection('@alice/kit', { all: true });

    expect(mockResolveCollection).toHaveBeenCalledWith(
      { extends: ['@alice/kit'] },
      'spm_xyz',
    );
  });

  it('passes null token when anonymous', async () => {
    mockGetToken.mockReturnValue(null);
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });

    await executeInstallFromCollection('@alice/kit', { all: true });

    expect(mockResolveCollection).toHaveBeenCalledWith(
      { extends: ['@alice/kit'] },
      null,
    );
  });

  it('prints warnings for each kind', async () => {
    const logSpy = vi.mocked(console.log);
    mockResolveCollection.mockResolvedValueOnce({
      members: [],
      warnings: [
        { kind: 'private-skipped', detail: '@alice/secret' },
        { kind: 'cycle', detail: 'circular ref' },
        { kind: 'depth', detail: 'max depth' },
        { kind: 'missing', detail: '@alice/deleted' },
      ],
    });

    await executeInstallFromCollection('@alice/kit', { all: true });

    const calls = logSpy.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => String(c).includes('Private'))).toBe(true);
    expect(calls.some((c) => String(c).includes('cycle'))).toBe(true);
    expect(calls.some((c) => String(c).includes('depth'))).toBe(true);
    expect(calls.some((c) => String(c).includes('missing'))).toBe(true);
  });

  it('normalizes url form refs before resolve', async () => {
    mockResolveCollection.mockResolvedValueOnce({ members: [], warnings: [] });

    await executeInstallFromCollection('https://skillsmgr.dev/c/@alice/kit', { all: true });

    expect(mockResolveCollection).toHaveBeenCalledWith(
      { extends: ['@alice/kit'] },
      null,
    );
  });

  it('outputs JSON with correct shape', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: '1.0.0', source: '@alice/kit' },
      ],
      warnings: [{ kind: 'missing', detail: '@alice/old' }],
    });
    mockInstallFromRegistry.mockResolvedValue({ sourceKeys: [] });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await executeInstallFromCollection('@alice/kit', { all: true, json: true });

    const jsonCall = writeSpy.mock.calls.find((call) => {
      const s = call[0] as string;
      try {
        const p = JSON.parse(s);
        return 'collection' in p;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.collection).toBe('@alice/kit');
    expect(parsed.installed).toHaveLength(1);
    expect(parsed.failed).toHaveLength(0);
    expect(parsed.warnings).toHaveLength(1);
  });

  it('exits 1 on invalid ref', async () => {
    await expect(
      executeInstallFromCollection('not-a-ref', { all: true }),
    ).rejects.toThrow('process.exit');
  });

  it('upserts a collection group after at least one member installs', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: '1.0.0', source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry
      .mockResolvedValueOnce({ sourceKeys: ['registry/@alice/a'] })
      .mockResolvedValueOnce({ sourceKeys: ['registry/@alice/b'] });

    await executeInstallFromCollection('@alice/kit', { all: true });

    expect(mockUpsertCollectionGroup).toHaveBeenCalledWith(
      '@alice/kit',
      ['registry/@alice/a', 'registry/@alice/b'],
    );
  });

  it('skips collection group upsert when nothing installs', async () => {
    mockResolveCollection.mockResolvedValueOnce({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry.mockRejectedValue(new Error('network'));

    await expect(
      executeInstallFromCollection('@alice/kit', { all: true }),
    ).rejects.toThrow('process.exit');

    expect(mockUpsertCollectionGroup).not.toHaveBeenCalled();
  });
});

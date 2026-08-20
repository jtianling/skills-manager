import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockResolveCollection = vi.hoisted(() => vi.fn());
const mockInstallFromRegistry = vi.hoisted(() => vi.fn());
const mockGetToken = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockGetCollectionGroup = vi.hoisted(() => vi.fn());
const mockSetCollectionGroupMembers = vi.hoisted(() => vi.fn());

vi.mock('../services/registry.js', () => ({
  RegistryService: function () {
    return { resolveCollection: mockResolveCollection };
  },
}));

vi.mock('../services/auth.js', () => ({
  getToken: mockGetToken,
}));

vi.mock('./install-registry.js', () => ({
  installFromRegistry: mockInstallFromRegistry,
}));

vi.mock('../services/groups.js', () => ({
  GroupsService: function () {
    return {
      getCollectionGroup: mockGetCollectionGroup,
      setCollectionGroupMembers: mockSetCollectionGroupMembers,
    };
  },
  validateGroupName: () => {},
  validateCollectionGroupKey: () => {},
  isCollectionGroupKey: () => false,
}));

import * as constants from '../constants.js';
import { executeUpdateWithOptions } from './update.js';

describe('update <collection-ref>', () => {
  let testDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), `skillsmgr-update-collection-${id}`);
    mkdirSync(testDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResolveCollection.mockReset();
    mockInstallFromRegistry.mockReset();
    mockGetCollectionGroup.mockReset();
    mockSetCollectionGroupMembers.mockReset();
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('routes @owner/slug ref to collection sync', async () => {
    mockGetCollectionGroup.mockReturnValue({
      kind: 'collection',
      ref: '@alice/kit',
      members: ['registry/@alice/a'],
      installedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    mockResolveCollection.mockResolvedValue({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });
    mockInstallFromRegistry.mockResolvedValueOnce({
      sourceKeys: ['registry/@alice/b'],
      skillKeys: ['registry/@alice/b/b-one', 'registry/@alice/b/b-two'],
    });

    await executeUpdateWithOptions('@alice/kit');

    expect(mockResolveCollection).toHaveBeenCalledWith(
      { extends: ['@alice/kit'] },
      null,
    );
    expect(mockInstallFromRegistry).toHaveBeenCalledTimes(1);
    expect(mockSetCollectionGroupMembers).toHaveBeenCalledWith(
      '@alice/kit',
      ['registry/@alice/a', 'registry/@alice/b/b-one', 'registry/@alice/b/b-two'],
    );
  });

  it('exits 1 when collection group not installed', async () => {
    mockGetCollectionGroup.mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeUpdateWithOptions('@bob/missing')).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not install members already present', async () => {
    mockGetCollectionGroup.mockReturnValue({
      kind: 'collection',
      ref: '@alice/kit',
      members: [
        'registry/@alice/a/a-one',
        'registry/@alice/b/b-one',
        'registry/@alice/b/b-two',
      ],
      installedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    mockResolveCollection.mockResolvedValue({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
        { packageName: '@alice/b', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });

    await executeUpdateWithOptions('@alice/kit');

    expect(mockInstallFromRegistry).not.toHaveBeenCalled();
    expect(mockSetCollectionGroupMembers).toHaveBeenCalledWith('@alice/kit', [
      'registry/@alice/a/a-one',
      'registry/@alice/b/b-one',
      'registry/@alice/b/b-two',
    ]);
  });

  it('prunes removed members from snapshot but does not uninstall', async () => {
    mockGetCollectionGroup.mockReturnValue({
      kind: 'collection',
      ref: '@alice/kit',
      members: ['registry/@alice/a/a-one', 'registry/@alice/dropped/gone'],
      installedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    mockResolveCollection.mockResolvedValue({
      members: [
        { packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' },
      ],
      warnings: [],
    });

    await executeUpdateWithOptions('@alice/kit');

    expect(mockSetCollectionGroupMembers).toHaveBeenCalledWith(
      '@alice/kit',
      ['registry/@alice/a/a-one'],
    );
  });

  it('never writes a source key back over skill-key members', async () => {
    mockGetCollectionGroup.mockReturnValue({
      kind: 'collection',
      ref: '@alice/kit',
      members: ['registry/@alice/a/a-one', 'registry/@alice/a/a-two'],
      installedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    mockResolveCollection.mockResolvedValue({
      members: [{ packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' }],
      warnings: [],
    });

    await executeUpdateWithOptions('@alice/kit');

    const [, written] = mockSetCollectionGroupMembers.mock.calls[0];
    expect(written).toEqual(['registry/@alice/a/a-one', 'registry/@alice/a/a-two']);
    expect(written).not.toContain('registry/@alice/a');
  });

  it('keeps a pre-skill-key member instead of dropping the package', async () => {
    mockGetCollectionGroup.mockReturnValue({
      kind: 'collection',
      ref: '@alice/kit',
      members: ['registry/@alice/a'],
      installedAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    mockResolveCollection.mockResolvedValue({
      members: [{ packageName: '@alice/a', pinnedVersion: null, source: '@alice/kit' }],
      warnings: [],
    });

    await executeUpdateWithOptions('@alice/kit');

    expect(mockInstallFromRegistry).not.toHaveBeenCalled();
    expect(mockSetCollectionGroupMembers).toHaveBeenCalledWith('@alice/kit', [
      'registry/@alice/a',
    ]);
  });

  it('does not route bare owner/repo to collection sync', async () => {
    // anthropic/skills should NOT trigger collection logic since it doesn't start with @
    mockGetCollectionGroup.mockReturnValue(null);
    // Don't assert on update.ts internals — just verify resolveCollection wasn't called
    try {
      await executeUpdateWithOptions('anthropic/skills');
    } catch {
      // existing update flow may complain about no source — that's fine, we're checking routing only
    }
    expect(mockResolveCollection).not.toHaveBeenCalled();
  });
});

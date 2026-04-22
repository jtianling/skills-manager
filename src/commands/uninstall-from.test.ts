import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockExpandCollection = vi.hoisted(() => vi.fn());

vi.mock('./install-collection.js', () => ({
  expandCollectionRefToSkillNames: mockExpandCollection,
}));

import * as constants from '../constants.js';
import { executeUninstall } from './uninstall.js';

describe('uninstall --from (collection)', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-uninstall-from-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-uninstall-from-proj-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(testProjectDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir, writable: true,
    });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExpandCollection.mockReset();
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('resolves collection and runs uninstall with expanded skill names', async () => {
    mockExpandCollection.mockResolvedValueOnce({
      normalizedRef: '@alice/kit',
      skillNames: ['skill-a', 'skill-b'],
    });

    // Nothing installed — uninstallExplicitSkillName will no-op for each
    await executeUninstall(undefined, {
      from: '@alice/kit',
      y: true,
    });

    expect(mockExpandCollection).toHaveBeenCalledWith('@alice/kit');
  });

  it('returns early when collection is empty', async () => {
    mockExpandCollection.mockResolvedValueOnce(null);

    await executeUninstall(undefined, { from: '@alice/empty' });

    expect(mockExpandCollection).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when collection resolve fails', async () => {
    mockExpandCollection.mockRejectedValueOnce(new Error('network down'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      executeUninstall(undefined, { from: '@alice/kit' }),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('skips members that are not installed', async () => {
    mockExpandCollection.mockResolvedValueOnce({
      normalizedRef: '@alice/kit',
      skillNames: ['never-installed-a', 'never-installed-b'],
    });

    // Should complete without throwing — current uninstall handles "not installed" gracefully
    await executeUninstall(undefined, {
      from: '@alice/kit',
      y: true,
    });

    expect(mockExpandCollection).toHaveBeenCalled();
  });
});

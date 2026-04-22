import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockExpandCollection = vi.hoisted(() => vi.fn());

vi.mock('./install-collection.js', () => ({
  expandCollectionRefToSkillNames: mockExpandCollection,
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';

describe('remove --from (collection)', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-remove-from-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-remove-from-proj-${id}`);
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

  it('resolves collection and merges skill names into options', async () => {
    mockExpandCollection.mockResolvedValueOnce({
      normalizedRef: '@alice/kit',
      skillNames: ['skill-a', 'skill-b'],
    });

    // No deployed skills — remove should just log nothing-to-remove and return without error
    await executeRemove(undefined, { from: '@alice/kit', sameAgents: true });

    expect(mockExpandCollection).toHaveBeenCalledWith('@alice/kit');
  });

  it('returns early when collection is empty', async () => {
    mockExpandCollection.mockResolvedValueOnce(null);

    await executeRemove(undefined, { from: '@alice/empty' });

    expect(mockExpandCollection).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when collection resolve fails', async () => {
    mockExpandCollection.mockRejectedValueOnce(new Error('network down'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      executeRemove(undefined, { from: '@alice/kit' }),
    ).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('skips members that are not deployed (no error)', async () => {
    // Create one deployed skill (skill-a); collection has skill-a and skill-ghost
    const customDir = join(testManagerDir, 'custom', 'skill-a');
    mkdirSync(customDir, { recursive: true });
    writeFileSync(join(customDir, 'SKILL.md'), '---\nname: skill-a\ndescription: t\n---\n');

    mockExpandCollection.mockResolvedValueOnce({
      normalizedRef: '@alice/kit',
      skillNames: ['skill-a', 'skill-ghost'],
    });

    // Should not throw even though skill-ghost doesn't exist
    await executeRemove(undefined, { from: '@alice/kit', sameAgents: true, all: true });

    expect(mockExpandCollection).toHaveBeenCalled();
  });
});

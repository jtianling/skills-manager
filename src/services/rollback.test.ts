import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockRemoveSource = vi.fn();
vi.mock('./sources.js', () => ({
  SourcesService: vi.fn().mockImplementation(() => ({
    removeSource: mockRemoveSource,
  })),
}));

import { rollbackInstall } from './rollback.js';

describe('rollbackInstall', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-rollback-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('removes installed directory and calls removeSource', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const installPath = join(testDir, 'community', 'owner', 'repo');
    mkdirSync(installPath, { recursive: true });
    writeFileSync(join(installPath, 'SKILL.md'), '---\nname: test\n---\n');

    rollbackInstall(installPath, 'community/owner/repo');

    expect(existsSync(installPath)).toBe(false);
    expect(mockRemoveSource).toHaveBeenCalledWith('community/owner/repo');
    expect(logSpy).toHaveBeenCalledWith('Installation rolled back.');
  });

  it('still cleans source even when directory does not exist', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const nonExistentPath = join(testDir, 'does-not-exist-nested', 'deep');

    rollbackInstall(nonExistentPath, 'community/test');

    expect(mockRemoveSource).toHaveBeenCalledWith('community/test');
    expect(logSpy).toHaveBeenCalledWith('Installation rolled back.');
  });
});

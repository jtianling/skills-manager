import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import * as constants from '../constants.js';
import { GitService } from './git.js';

describe('GitService', () => {
  let testDir: string;
  let service: GitService;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), `skillsmgr-git-test-${id}`);
    mkdirSync(testDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });
    service = new GitService();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('clone', () => {
    it('clones to community directory by default', () => {
      service.clone('https://github.com/someowner/somerepo', false);

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git clone --depth 1'),
        expect.anything(),
      );
      const callArg = vi.mocked(execSync).mock.calls[0][0] as string;
      expect(callArg).toContain(join(testDir, 'community', 'someowner', 'somerepo'));
    });

    it('clones to custom directory when isCustom is true', () => {
      service.clone('https://github.com/someowner/somerepo', true);

      const callArg = vi.mocked(execSync).mock.calls[0][0] as string;
      expect(callArg).toContain(join(testDir, 'custom', 'somerepo'));
    });

    it('clones to official directory for official providers', () => {
      service.clone('https://github.com/anthropics/skills', false);

      const callArg = vi.mocked(execSync).mock.calls[0][0] as string;
      expect(callArg).toContain(join(testDir, 'official', 'anthropic', 'skills'));
    });

    it('does git pull when target already exists', () => {
      const targetDir = join(testDir, 'community', 'someowner', 'somerepo');
      mkdirSync(targetDir, { recursive: true });

      service.clone('https://github.com/someowner/somerepo', false);

      expect(execSync).toHaveBeenCalledWith('git pull', expect.objectContaining({ cwd: targetDir }));
    });
  });

  describe('isSpecificSkillUrl', () => {
    it('returns true for tree URLs', () => {
      expect(service.isSpecificSkillUrl('https://github.com/org/repo/tree/main/skills/my-skill')).toBe(true);
    });

    it('returns false for plain repo URLs', () => {
      expect(service.isSpecificSkillUrl('https://github.com/org/repo')).toBe(false);
    });
  });

  describe('cloneSpecificSkill', () => {
    it('returns null for non-tree URLs', () => {
      expect(service.cloneSpecificSkill('https://github.com/org/repo')).toBeNull();
    });

    it('uses sparse checkout for tree URLs', () => {
      service.cloneSpecificSkill('https://github.com/org/repo/tree/main/skills/my-skill');

      const calls = vi.mocked(execSync).mock.calls.map((c) => c[0] as string);
      expect(calls.some((c) => c.includes('git init'))).toBe(true);
      expect(calls.some((c) => c.includes('sparse'))).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureDir, copyFile, linkFile, isSymlink, readFileContent, fileExists, getDirectoriesInDir } from './fs.js';

describe('fs utils', () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('creates directory if not exists', () => {
      const dir = join(testDir, 'new-dir');
      ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });

    it('does nothing if directory exists', () => {
      const dir = join(testDir, 'existing-dir');
      mkdirSync(dir);
      ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('copyFile', () => {
    it('copies file to destination', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest', 'copied.txt');
      writeFileSync(src, 'content');
      copyFile(src, dest);
      expect(readFileSync(dest, 'utf-8')).toBe('content');
    });
  });

  describe('linkFile', () => {
    it('creates symlink to source', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'link.txt');
      writeFileSync(src, 'content');
      linkFile(src, dest);
      expect(isSymlink(dest)).toBe(true);
      expect(readFileSync(dest, 'utf-8')).toBe('content');
    });

    it('replaces existing file with symlink', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'existing.txt');
      writeFileSync(src, 'new content');
      writeFileSync(dest, 'old content');
      linkFile(src, dest);
      expect(isSymlink(dest)).toBe(true);
    });
  });

  describe('getDirectoriesInDir', () => {
    it('returns only directories', () => {
      mkdirSync(join(testDir, 'dir1'));
      mkdirSync(join(testDir, 'dir2'));
      writeFileSync(join(testDir, 'file.txt'), 'content');
      const dirs = getDirectoriesInDir(testDir);
      expect(dirs.map(d => d.name).sort()).toEqual(['dir1', 'dir2']);
    });

    it('returns empty array for non-existent directory', () => {
      const dirs = getDirectoriesInDir(join(testDir, 'nonexistent'));
      expect(dirs).toEqual([]);
    });
  });
});

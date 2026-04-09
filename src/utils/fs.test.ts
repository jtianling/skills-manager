import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
} from 'fs';
import net from 'net';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  ensureDir,
  copyDir,
  copyFile,
  linkFile,
  isSymlink,
  getDirectoriesInDir,
} from './fs.js';

describe('fs utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
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

  describe('copyDir', () => {
    it('preserves symlink to file', () => {
      const src = join(testDir, 'src');
      const dest = join(testDir, 'dest');
      mkdirSync(src, { recursive: true });
      writeFileSync(join(src, 'real-file.txt'), 'content');
      symlinkSync('real-file.txt', join(src, 'link-file'), 'file');

      copyDir(src, dest);

      const copiedLink = join(dest, 'link-file');
      expect(lstatSync(copiedLink).isSymbolicLink()).toBe(true);
      expect(readlinkSync(copiedLink)).toBe('real-file.txt');
      expect(readFileSync(copiedLink, 'utf-8')).toBe('content');
    });

    it('preserves symlink to directory', () => {
      const src = join(testDir, 'src');
      const dest = join(testDir, 'dest');
      mkdirSync(join(src, 'target-dir'), { recursive: true });
      writeFileSync(join(src, 'target-dir', 'nested.txt'), 'nested');
      symlinkSync('target-dir', join(src, 'link-dir'), 'dir');

      copyDir(src, dest);

      const copiedLink = join(dest, 'link-dir');
      expect(lstatSync(copiedLink).isSymbolicLink()).toBe(true);
      expect(readlinkSync(copiedLink)).toBe('target-dir');
      expect(readFileSync(join(copiedLink, 'nested.txt'), 'utf-8')).toBe('nested');
    });

    it('preserves symlink in nested directory', () => {
      const src = join(testDir, 'src');
      const dest = join(testDir, 'dest');
      mkdirSync(join(src, 'nested'), { recursive: true });
      writeFileSync(join(src, 'nested', 'target.txt'), 'nested-content');
      symlinkSync('target.txt', join(src, 'nested', 'link.txt'), 'file');

      copyDir(src, dest);

      const copiedLink = join(dest, 'nested', 'link.txt');
      expect(lstatSync(copiedLink).isSymbolicLink()).toBe(true);
      expect(readlinkSync(copiedLink)).toBe('target.txt');
      expect(readFileSync(copiedLink, 'utf-8')).toBe('nested-content');
    });

    it('silently skips non-regular files like unix sockets', async () => {
      const src = join(testDir, 'src');
      const dest = join(testDir, 'dest');
      const socketPath = join(src, 'test.sock');
      const copiedFile = join(dest, 'regular.txt');
      const copiedSocket = join(dest, 'test.sock');
      mkdirSync(src, { recursive: true });
      writeFileSync(join(src, 'regular.txt'), 'content');

      const server = net.createServer();
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(socketPath, () => {
            server.off('error', reject);
            resolve();
          });
        });
      } catch (error) {
        expect(['EPERM', 'EACCES', 'EOPNOTSUPP']).toContain(
          (error as NodeJS.ErrnoException).code,
        );
        return;
      }

      try {
        copyDir(src, dest);

        expect(readFileSync(copiedFile, 'utf-8')).toBe('content');
        expect(existsSync(copiedSocket)).toBe(false);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
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

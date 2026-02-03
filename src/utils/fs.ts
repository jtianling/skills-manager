import {
  existsSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
  lstatSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  rmSync,
} from 'fs';
import { dirname, join } from 'path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

export function linkFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  symlinkSync(src, dest);
}

export function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function readFileContent(path: string): string {
  return readFileSync(path, 'utf-8');
}

export function writeFile(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf-8');
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function removeFile(path: string): void {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function removeDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface DirInfo {
  name: string;
  path: string;
}

export function getDirectoriesInDir(dir: string): DirInfo[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      path: join(dir, e.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

export function linkDir(src: string, dest: string): void {
  ensureDir(dirname(dest));
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  symlinkSync(src, dest);
}

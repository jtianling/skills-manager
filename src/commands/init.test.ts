import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { executeInit } from './init.js';

describe('init command', () => {
  let testDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), `skillsmgr-init-${id}`);
    mkdirSync(testDir, { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates skill.json with --yes using defaults', async () => {
    await executeInit({ yes: true });

    const manifestPath = join(testDir, 'skill.json');
    expect(existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(content.name).toBeTruthy();
    expect(content.version).toBe('1.0.0');
    expect(content).toHaveProperty('description');
  });

  it('fails if skill.json already exists', async () => {
    writeFileSync(join(testDir, 'skill.json'), '{}');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeInit({ yes: true })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('derives package name from directory name', async () => {
    const namedDir = join(tmpdir(), `skillsmgr-init-My-Cool-Skill-${Date.now()}`);
    mkdirSync(namedDir, { recursive: true });
    process.cwd = () => namedDir;

    await executeInit({ yes: true });

    const content = JSON.parse(readFileSync(join(namedDir, 'skill.json'), 'utf-8'));
    expect(content.name).toMatch(/^[a-z0-9]/);
    expect(content.name).not.toMatch(/[A-Z]/);

    rmSync(namedDir, { recursive: true, force: true });
  });
});

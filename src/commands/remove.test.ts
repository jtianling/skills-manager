import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';

describe('remove command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-remove-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-remove-test-proj-${id}`);

    mkdirSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: test\n---\n',
    );
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('removes a deployed skill', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    await executeRemove('code-review');

    expect(existsSync(deployedPath)).toBe(false);
  });

  it('exits when skill not found in deployed skills', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('nonexistent')).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits when no skills deployed', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('anything')).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

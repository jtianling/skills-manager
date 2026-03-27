import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/fs.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/fs.js')>();
  return {
    ...actual,
    copyDir: vi.fn(),
  };
});

import * as constants from '../constants.js';
import { copyDir } from '../utils/fs.js';

describe('setup command', () => {
  let testDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), `skillsmgr-setup-test-${id}`);
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('creates official, community, custom directories', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    expect(existsSync(join(testDir, 'official'))).toBe(true);
    expect(existsSync(join(testDir, 'community'))).toBe(true);
    expect(existsSync(join(testDir, 'custom'))).toBe(true);
  });

  it('copies example-skill template when target does not exist', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    expect(copyDir).toHaveBeenCalledWith(
      expect.stringContaining('example-skill'),
      join(testDir, 'custom', 'example-skill'),
    );
  });

  it('skips copy when example-skill already exists', async () => {
    mkdirSync(join(testDir, 'custom', 'example-skill'), { recursive: true });
    writeFileSync(join(testDir, 'custom', 'example-skill', 'SKILL.md'), 'existing');

    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    expect(copyDir).not.toHaveBeenCalled();
    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.some((l) => typeof l === 'string' && l.includes('already exists'))).toBe(true);
  });

  it('outputs Setup complete', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.some((l) => typeof l === 'string' && l.includes('Setup complete'))).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as constants from '../constants.js';

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

  it('does not create example-skill', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    expect(existsSync(join(testDir, 'custom', 'example-skill'))).toBe(false);
  });

  it('outputs Setup complete', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.some((l) => typeof l === 'string' && l.includes('Setup complete'))).toBe(true);
  });

  it('shows deploy in Next steps', async () => {
    const { executeSetup } = await import('./setup.js');
    await executeSetup();

    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.some((l) => typeof l === 'string' && l.includes('skillsmgr deploy'))).toBe(true);
    expect(logs.every((l) => typeof l !== 'string' || !l.includes('skillsmgr init'))).toBe(true);
  });

  it('ensureSetup skips when directory exists', async () => {
    mkdirSync(testDir, { recursive: true });

    const { ensureSetup } = await import('./setup.js');
    await ensureSetup();

    const logs = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(logs.every((l) => typeof l !== 'string' || !l.includes('Setup complete'))).toBe(true);
  });

  it('ensureSetup creates directory when missing', async () => {
    const { ensureSetup } = await import('./setup.js');
    await ensureSetup();

    expect(existsSync(join(testDir, 'official'))).toBe(true);
  });
});

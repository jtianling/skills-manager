import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToInstall: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { executeInstall } from './install.js';

describe('install --json', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-installjson-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-installjson-proj-${id}`);

    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(testProjectDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('outputs JSON on successful local install', async () => {
    // Create a local skill directory to install
    const sourceDir = join(tmpdir(), `skillsmgr-installjson-src-${Date.now()}`);
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'SKILL.md'), '---\nname: test-skill\ndescription: Test\n---\n');

    await executeInstall(sourceDir, { json: true });

    const jsonCalls = stdoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('"installed"')
    );
    expect(jsonCalls.length).toBeGreaterThan(0);

    const parsed = JSON.parse(jsonCalls[0][0] as string);
    expect(parsed.installed).toBeDefined();
    expect(parsed.installed.source).toBe(sourceDir);

    rmSync(sourceDir, { recursive: true, force: true });
  });

  it('outputs error JSON on install failure', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      executeInstall('/nonexistent/path/that/does/not/exist', { json: true })
    ).rejects.toThrow('process.exit');

    const jsonCalls = stdoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('"error"')
    );
    expect(jsonCalls.length).toBeGreaterThan(0);

    const parsed = JSON.parse(jsonCalls[0][0] as string);
    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('INSTALL_ERROR');
  });
});

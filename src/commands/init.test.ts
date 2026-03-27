import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, readlinkSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', () => ({
  promptAgents: vi.fn().mockResolvedValue(['agents-skills-standard']),
  promptSkills: vi.fn().mockResolvedValue([]),
}));

vi.mock('./setup.js', () => ({
  executeSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { executeInit } from './init.js';
import { promptAgents, promptSkills } from '../utils/prompts.js';

describe('init command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-init-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-init-test-proj-${id}`);

    mkdirSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: Reviews code\n---\n',
    );
    mkdirSync(join(testManagerDir, 'custom', 'my-skill'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'custom', 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: My skill\n---\n',
    );

    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('deploys selected skills as symlinks by default', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeInit({});

    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    expect(existsSync(deployedPath)).toBe(true);
    expect(lstatSync(deployedPath).isSymbolicLink()).toBe(true);
  });

  it('deploys as copy when --copy option is set', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeInit({ copy: true });

    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    expect(existsSync(deployedPath)).toBe(true);
    expect(lstatSync(deployedPath).isSymbolicLink()).toBe(false);
  });

  it('creates symlink bridge for non-native tools', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard', 'claude-code']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeInit({});

    const bridgePath = join(testProjectDir, '.claude', 'skills');
    expect(existsSync(bridgePath)).toBe(true);
    expect(lstatSync(bridgePath).isSymbolicLink()).toBe(true);
  });

  it('exits when no skills available', async () => {
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: join(tmpdir(), `empty-${Date.now()}`),
      writable: true,
    });
    mkdirSync(constants.SKILLS_MANAGER_DIR, { recursive: true });

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeInit({})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    rmSync(constants.SKILLS_MANAGER_DIR, { recursive: true, force: true });
  });

  it('does not remove unmanaged skills', async () => {
    const unmanagedPath = join(testProjectDir, '.agents', 'skills', 'manual-skill');
    mkdirSync(unmanagedPath, { recursive: true });
    writeFileSync(join(unmanagedPath, 'SKILL.md'), '---\nname: manual-skill\n---\n');

    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeInit({});

    expect(existsSync(unmanagedPath)).toBe(true);
  });
});

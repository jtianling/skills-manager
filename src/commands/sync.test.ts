import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../constants.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants.js')>();
  const { tmpdir: _tmpdir } = await import('os');
  const { join: _join } = await import('path');
  return { ...actual, SKILLS_MANAGER_DIR: _join(_tmpdir(), `skillsmgr-sync-${process.pid}`, '.skills-manager') };
});

vi.mock('../utils/prompts.js', () => ({
  promptSyncAction: vi.fn().mockResolvedValue('skip'),
  promptOrphanAction: vi.fn().mockResolvedValue('keep'),
}));

import { SKILLS_MANAGER_DIR } from '../constants.js';
import { executeSync } from './sync.js';
import { promptSyncAction, promptOrphanAction } from '../utils/prompts.js';

describe('sync command', () => {
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  function setupSkill(name: string): string {
    const skillDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: test\n---\nContent`);
    return skillDir;
  }

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testProjectDir = join(tmpdir(), `skillsmgr-sync-test-proj-${id}`);

    mkdirSync(join(SKILLS_MANAGER_DIR, 'official'), { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reports link skill as up to date', async () => {
    const sourceDir = setupSkill('code-review');
    symlinkSync(sourceDir, join(testProjectDir, '.agents', 'skills', 'code-review'));

    await executeSync();

    const logs = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('up to date'))).toBe(true);
  });

  it('reports copy skill as up to date when content matches', async () => {
    setupSkill('code-review');
    const deployedDir = join(testProjectDir, '.agents', 'skills', 'code-review');
    mkdirSync(deployedDir, { recursive: true });
    writeFileSync(
      join(deployedDir, 'SKILL.md'),
      `---\nname: code-review\ndescription: test\n---\nContent`,
    );

    await executeSync();

    const logs = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('up to date (copy)'))).toBe(true);
  });

  it('detects changed copy and prompts sync action', async () => {
    setupSkill('code-review');
    const deployedDir = join(testProjectDir, '.agents', 'skills', 'code-review');
    mkdirSync(deployedDir, { recursive: true });
    writeFileSync(join(deployedDir, 'SKILL.md'), 'different content');

    vi.mocked(promptSyncAction).mockResolvedValue('skip');

    await executeSync();

    const logs = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('source changed'))).toBe(true);
    expect(promptSyncAction).toHaveBeenCalled();
  });

  it('detects orphan and prompts action', async () => {
    const deployedDir = join(testProjectDir, '.agents', 'skills', 'orphan-skill');
    mkdirSync(deployedDir, { recursive: true });
    writeFileSync(join(deployedDir, 'SKILL.md'), '---\nname: orphan-skill\n---\n');

    vi.mocked(promptOrphanAction).mockResolvedValue('keep');

    await executeSync();

    const logs = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('orphan') || l.includes('unmanaged'))).toBe(true);
  });

  it('exits when no skills deployed', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeSync()).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

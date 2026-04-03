import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));
vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import type { ToolName } from '../types.js';

function createSkill(managerDir: string, source: string, name: string): string {
  const skillDir = join(managerDir, source, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test\n---\n`,
  );
  return skillDir;
}

describe('remove --json', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let testGlobalDir: string;
  let originalCwd: typeof process.cwd;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  const savedGlobalDirs = new Map<string, string>();

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-removejson-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-removejson-proj-${id}`);
    testGlobalDir = join(tmpdir(), `skillsmgr-removejson-global-${id}`);

    createSkill(testManagerDir, 'official/anthropic/skills', 'code-review');
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });
    mkdirSync(testGlobalDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    for (const name of ['claude-code'] as ToolName[]) {
      savedGlobalDirs.set(name, TOOL_CONFIGS[name].globalSkillsDir);
      (TOOL_CONFIGS[name] as { globalSkillsDir: string }).globalSkillsDir = join(testGlobalDir, name);
    }

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    for (const [name, dir] of savedGlobalDirs) {
      (TOOL_CONFIGS[name as ToolName] as { globalSkillsDir: string }).globalSkillsDir = dir;
    }
    savedGlobalDirs.clear();
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    rmSync(testGlobalDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('outputs removed skills as JSON', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    symlinkSync(skillSource, join(testProjectDir, '.agents', 'skills', 'code-review'));

    await executeRemove('code-review', { json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.removed).toBeInstanceOf(Array);
    expect(parsed.removed).toContainEqual({ name: 'code-review' });
  });

  it('json implies yes (skips prompts)', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    symlinkSync(skillSource, join(testProjectDir, '.agents', 'skills', 'code-review'));

    await executeRemove('code-review', { json: true });

    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('outputs error JSON when skill not found', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('nonexistent', { json: true })).rejects.toThrow('process.exit');

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('NOT_FOUND');
  });
});

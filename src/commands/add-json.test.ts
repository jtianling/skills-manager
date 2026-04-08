import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));
vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { executeAdd } from './add.js';
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

describe('add --json', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let testGlobalDir: string;
  let originalCwd: typeof process.cwd;
  let stdoutSpy: any;
  const savedGlobalDirs = new Map<string, string>();

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-addjson-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-addjson-proj-${id}`);
    testGlobalDir = join(tmpdir(), `skillsmgr-addjson-global-${id}`);

    createSkill(testManagerDir, 'official/anthropic/skills', 'code-review');
    createSkill(testManagerDir, 'official/anthropic/skills', 'commit-msg');
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

  it('outputs deployed skills as JSON when adding by name', async () => {
    await executeAdd('code-review', {
      json: true,
      agent: ['claude-code'],
    });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.deployed).toBeInstanceOf(Array);
    expect(parsed.deployed).toContainEqual(
      expect.objectContaining({ name: 'code-review' }),
    );
  });

  it('json implies yes (skips prompts)', async () => {
    await executeAdd('code-review', {
      json: true,
      agent: ['claude-code'],
    });

    // Should not throw or hang — prompts are skipped
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('outputs deployed array for batch add with --all', async () => {
    await executeAdd(undefined, {
      json: true,
      agent: ['claude-code'],
    });

    // With --json implying --yes which expands to --all + --same-agents,
    // but --agent is explicitly set so it uses that.
    // Should output JSON with deployed array
    const calls = stdoutSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('"deployed"')
    );
    expect(calls.length).toBeGreaterThan(0);
  });
});

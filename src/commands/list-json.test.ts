import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import { executeList } from './list.js';

describe('list --json', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;
  let stdoutSpy: any;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-listjson-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-listjson-proj-${id}`);

    mkdirSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: Reviews code\n---\n',
    );
    mkdirSync(join(testManagerDir, 'custom', 'my-tool'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'custom', 'my-tool', 'SKILL.md'),
      '---\nname: my-tool\ndescription: My tool\n---\n',
    );

    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

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

  it('outputs available skills as JSON', async () => {
    await executeList({ json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.skills).toBeInstanceOf(Array);
    expect(parsed.skills).toContainEqual(
      expect.objectContaining({ name: 'code-review', source: 'official/anthropic/skills' }),
    );
    expect(parsed.skills).toContainEqual(
      expect.objectContaining({ name: 'my-tool', source: 'custom' }),
    );
  });

  it('outputs deployed skills as JSON', async () => {
    const { symlinkSync } = await import('fs');
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    symlinkSync(skillSource, join(testProjectDir, '.agents', 'skills', 'code-review'));

    await executeList({ deployed: true, json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.skills).toBeInstanceOf(Array);
    expect(parsed.skills.length).toBeGreaterThan(0);
    expect(parsed.skills[0]).toHaveProperty('name');
    expect(parsed.skills[0]).toHaveProperty('source');
  });

  it('outputs empty skills array when no skills found', async () => {
    const emptyDir = join(tmpdir(), `skillsmgr-listjson-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: emptyDir, writable: true });

    await executeList({ json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);
    expect(parsed.skills).toEqual([]);

    rmSync(emptyDir, { recursive: true, force: true });
  });
});

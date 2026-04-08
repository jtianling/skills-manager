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
vi.mock('../utils/prompts.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/prompts.js')>();
  return {
    ...original,
    loadGroupsData: vi.fn().mockReturnValue({}),
    promptAgents: vi.fn().mockResolvedValue(['agents-skills-standard']),
    promptAgentsGlobal: vi.fn().mockResolvedValue([]),
    promptSkills: vi.fn().mockResolvedValue([]),
  };
});

import * as constants from '../constants.js';
import { executeDeploy } from './deploy.js';
import { promptSkills } from '../utils/prompts.js';

function createSkill(managerDir: string, source: string, name: string): string {
  const skillDir = join(managerDir, source, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test\n---\n`,
  );
  return skillDir;
}

describe('deploy --json', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;
  let stdoutSpy: any;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-deployjson-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-deployjson-proj-${id}`);

    createSkill(testManagerDir, 'official/anthropic/skills', 'code-review');
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

  it('outputs deployed skills as JSON', async () => {
    await executeDeploy({ json: true, agent: ['agents-skills-standard'] });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.deployed).toBeInstanceOf(Array);
    expect(parsed.deployed).toContainEqual(
      expect.objectContaining({ name: 'code-review' }),
    );
  });

  it('outputs error JSON when no skills found', async () => {
    const emptyDir = join(tmpdir(), `skillsmgr-deployjson-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: emptyDir, writable: true });

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeDeploy({ json: true })).rejects.toThrow('process.exit');

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.error).toBeDefined();
    expect(parsed.code).toBe('NO_SKILLS');

    rmSync(emptyDir, { recursive: true, force: true });
  });
});

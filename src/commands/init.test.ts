import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockPrompt = vi.hoisted(() => vi.fn());
const mockReadAuth = vi.hoisted(() => vi.fn());

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

vi.mock('../services/auth.js', () => ({
  readAuth: mockReadAuth,
}));

import { executeInit } from './init.js';

describe('init command', () => {
  let testDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testDir = join(tmpdir(), `skillsmgr-init-${id}`);
    mkdirSync(testDir, { recursive: true });
    originalCwd = process.cwd;
    process.cwd = () => testDir;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockPrompt.mockReset();
    mockReadAuth.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates skill.json with --yes using defaults', async () => {
    await executeInit({ yes: true });

    const manifestPath = join(testDir, 'skill.json');
    expect(existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(content.name).toBeTruthy();
    expect(content.version).toBe('1.0.0');
    expect(content).toHaveProperty('description');
  });

  it('fails if skill.json already exists', async () => {
    writeFileSync(join(testDir, 'skill.json'), '{}');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeInit({ yes: true })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('derives package name from directory name', async () => {
    const namedDir = join(tmpdir(), `skillsmgr-init-My-Cool-Skill-${Date.now()}`);
    mkdirSync(namedDir, { recursive: true });
    process.cwd = () => namedDir;

    await executeInit({ yes: true });

    const content = JSON.parse(readFileSync(join(namedDir, 'skill.json'), 'utf-8'));
    expect(content.name).toMatch(/^[a-z0-9]/);
    expect(content.name).not.toMatch(/[A-Z]/);

    rmSync(namedDir, { recursive: true, force: true });
  });

  it('defaults version=1.0.0 and license=MIT, no prompts for them', async () => {
    mockPrompt.mockResolvedValueOnce({
      name: 'my-skill',
      description: 'A test skill',
      dependencies: '',
    });

    await executeInit({});

    const promptArgs = mockPrompt.mock.calls[0][0] as Array<{ name: string }>;
    const promptedNames = promptArgs.map((p) => p.name);
    expect(promptedNames).toEqual(['name', 'description', 'dependencies']);

    const content = JSON.parse(readFileSync(join(testDir, 'skill.json'), 'utf-8'));
    expect(content.version).toBe('1.0.0');
    expect(content.license).toBe('MIT');
    expect(content.description).toBe('A test skill');
  });

  it('uses logged-in username as author', async () => {
    mockReadAuth.mockReturnValue({ username: 'alice', token: 'spm_test' });
    mockPrompt.mockResolvedValueOnce({
      name: 'my-skill',
      description: 'desc',
      dependencies: '',
    });

    await executeInit({});

    const content = JSON.parse(readFileSync(join(testDir, 'skill.json'), 'utf-8'));
    expect(content.author).toBe('alice');
  });

  it('omits author field when not logged in', async () => {
    mockReadAuth.mockReturnValue(null);
    mockPrompt.mockResolvedValueOnce({
      name: 'my-skill',
      description: 'desc',
      dependencies: '',
    });

    await executeInit({});

    const content = JSON.parse(readFileSync(join(testDir, 'skill.json'), 'utf-8'));
    expect(content).not.toHaveProperty('author');
  });

  it('parses dependencies from comma-separated input', async () => {
    mockPrompt.mockResolvedValueOnce({
      name: 'my-skill',
      description: 'desc',
      dependencies: '@scope/a, @scope/b , owner/repo:c',
    });

    await executeInit({});

    const content = JSON.parse(readFileSync(join(testDir, 'skill.json'), 'utf-8'));
    expect(content.dependencies).toEqual(['@scope/a', '@scope/b', 'owner/repo:c']);
  });

  it('description prompt validates non-empty', async () => {
    mockPrompt.mockResolvedValueOnce({
      name: 'my-skill',
      description: 'has content',
      dependencies: '',
    });

    await executeInit({});

    const promptArgs = mockPrompt.mock.calls[0][0] as Array<{ name: string; validate?: (s: string) => boolean | string }>;
    const desc = promptArgs.find((p) => p.name === 'description');
    expect(desc?.validate).toBeDefined();
    expect(desc!.validate!('')).toBe('Description is required');
    expect(desc!.validate!('something')).toBe(true);
  });
});

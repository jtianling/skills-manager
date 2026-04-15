import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/prompts.js')>();
  return {
    ...original,
    loadGroupsData: vi.fn().mockReturnValue({}),
    promptAgents: vi.fn().mockResolvedValue(['agents-skills-standard']),
    promptSkills: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('./setup.js', () => ({
  executeSetup: vi.fn(),
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { executeDeploy } from './deploy.js';
import { loadGroupsData, promptAgents, promptSkills } from '../utils/prompts.js';

describe('deploy command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-deploy-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-deploy-test-proj-${id}`);

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

    await executeDeploy({});

    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    expect(existsSync(deployedPath)).toBe(true);
    expect(lstatSync(deployedPath).isSymbolicLink()).toBe(true);
  });

  it('deploys as copy when --copy option is set', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeDeploy({ copy: true });

    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    expect(existsSync(deployedPath)).toBe(true);
    expect(lstatSync(deployedPath).isSymbolicLink()).toBe(false);
  });

  it('creates symlink bridge for non-native tools', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard', 'claude-code']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeDeploy({});

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

    await expect(executeDeploy({})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    rmSync(constants.SKILLS_MANAGER_DIR, { recursive: true, force: true });
  });

  it('does not remove unmanaged skills', async () => {
    const unmanagedPath = join(testProjectDir, '.agents', 'skills', 'manual-skill');
    mkdirSync(unmanagedPath, { recursive: true });
    writeFileSync(join(unmanagedPath, 'SKILL.md'), '---\nname: manual-skill\n---\n');

    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);

    await executeDeploy({});

    expect(existsSync(unmanagedPath)).toBe(true);
  });

  it('passes virtual groups data into skill prompt', async () => {
    vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
    vi.mocked(promptSkills).mockResolvedValue(['code-review']);
    vi.mocked(loadGroupsData).mockReturnValue({
      dev: ['official/anthropic/skills/code-review'],
    });

    await executeDeploy({});

    expect(promptSkills).toHaveBeenCalledWith(
      expect.any(Array),
      [],
      { dev: ['official/anthropic/skills/code-review'] },
    );
  });

  describe('deployment manifest', () => {
    function readManifestFile(): {
      mode: string;
      followGroups: string[];
      pinnedSkills: string[];
      deployedAt: string;
    } {
      return JSON.parse(
        require('fs').readFileSync(
          join(testProjectDir, '.skills-manager', 'deployment.json'),
          'utf-8',
        ),
      );
    }

    function writeGroupsJson(data: Record<string, string[]>): void {
      writeFileSync(join(testManagerDir, 'groups.json'), JSON.stringify(data, null, 2));
    }

    it('writes manifest after deploy with pinnedSkills', async () => {
      vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
      vi.mocked(promptSkills).mockResolvedValue(['code-review']);

      await executeDeploy({});

      const manifest = readManifestFile();
      expect(manifest.mode).toBe('link');
      expect(manifest.pinnedSkills).toEqual(['official/anthropic/skills/code-review']);
      expect(manifest.followGroups).toEqual([]);
      expect(manifest.deployedAt).toMatch(/^\d{4}-/);
    });

    it('--follow-group non-existent fails fast', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(
        executeDeploy({ followGroup: ['nonexistent'], y: true }),
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(existsSync(join(testProjectDir, '.skills-manager', 'deployment.json'))).toBe(false);
    });

    it('--follow-group filters group skills from prompt and deploys them', async () => {
      writeGroupsJson({ dev: ['custom/my-skill'] });
      vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
      vi.mocked(promptSkills).mockResolvedValue([]);

      await executeDeploy({ followGroup: ['dev'] });

      const allSkillsArg = vi.mocked(promptSkills).mock.calls[0]?.[0];
      const promptedNames = allSkillsArg?.map((s) => s.name) ?? [];
      expect(promptedNames).not.toContain('my-skill');
      expect(promptedNames).toContain('code-review');

      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'my-skill'))).toBe(true);

      const manifest = readManifestFile();
      expect(manifest.followGroups).toEqual(['dev']);
      expect(manifest.pinnedSkills).toEqual([]);
    });

    it('second deploy overwrites pinnedSkills and unions followGroups', async () => {
      writeGroupsJson({ dev: ['custom/my-skill'] });
      vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
      vi.mocked(promptSkills).mockResolvedValue(['code-review']);
      await executeDeploy({});

      let manifest = readManifestFile();
      expect(manifest.pinnedSkills).toEqual(['official/anthropic/skills/code-review']);

      vi.mocked(promptSkills).mockResolvedValue([]);
      await executeDeploy({ followGroup: ['dev'] });

      manifest = readManifestFile();
      expect(manifest.pinnedSkills).toEqual([]);
      expect(manifest.followGroups).toEqual(['dev']);

      vi.mocked(promptSkills).mockResolvedValue(['code-review']);
      await executeDeploy({ followGroup: ['dev'] });
      manifest = readManifestFile();
      expect(manifest.followGroups).toEqual(['dev']);
      expect(manifest.pinnedSkills).toEqual(['official/anthropic/skills/code-review']);
    });

    it('--refresh aligns deployed skills to manifest', async () => {
      writeGroupsJson({ dev: ['custom/my-skill', 'official/anthropic/skills/code-review'] });
      mkdirSync(join(testProjectDir, '.skills-manager'), { recursive: true });
      writeFileSync(
        join(testProjectDir, '.skills-manager', 'deployment.json'),
        JSON.stringify({
          mode: 'link',
          followGroups: ['dev'],
          pinnedSkills: [],
          deployedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      await executeDeploy({ refresh: true });

      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'my-skill'))).toBe(true);
      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'code-review'))).toBe(true);

      const manifest = readManifestFile();
      expect(manifest.deployedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('--refresh removes skills no longer in expected set', async () => {
      // Need .skills-manager segment in path for scanner source detection
      const wrappedManager = join(tmpdir(), `skillsmgr-wrap-${Date.now()}`, '.skills-manager');
      mkdirSync(
        join(wrappedManager, 'official', 'anthropic', 'skills', 'code-review'),
        { recursive: true },
      );
      writeFileSync(
        join(wrappedManager, 'official', 'anthropic', 'skills', 'code-review', 'SKILL.md'),
        '---\nname: code-review\n---\n',
      );
      mkdirSync(join(wrappedManager, 'custom', 'my-skill'), { recursive: true });
      writeFileSync(
        join(wrappedManager, 'custom', 'my-skill', 'SKILL.md'),
        '---\nname: my-skill\n---\n',
      );
      Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
        value: wrappedManager,
        writable: true,
      });
      writeFileSync(
        join(wrappedManager, 'groups.json'),
        JSON.stringify({ dev: ['custom/my-skill'] }),
      );

      mkdirSync(join(testProjectDir, '.skills-manager'), { recursive: true });
      writeFileSync(
        join(testProjectDir, '.skills-manager', 'deployment.json'),
        JSON.stringify({
          mode: 'link',
          followGroups: ['dev'],
          pinnedSkills: [],
          deployedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const reviewLink = join(testProjectDir, '.agents', 'skills', 'code-review');
      require('fs').symlinkSync(
        join(wrappedManager, 'official', 'anthropic', 'skills', 'code-review'),
        reviewLink,
      );

      await executeDeploy({ refresh: true });

      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'my-skill'))).toBe(true);
      expect(existsSync(reviewLink)).toBe(false);

      rmSync(join(wrappedManager, '..'), { recursive: true, force: true });
    });

    it('--refresh fails when manifest missing', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeDeploy({ refresh: true })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('writes to global registry after deploy', async () => {
      vi.mocked(promptAgents).mockResolvedValue(['agents-skills-standard']);
      vi.mocked(promptSkills).mockResolvedValue(['code-review']);

      await executeDeploy({});

      const registryPath = join(testManagerDir, 'deployments.json');
      expect(existsSync(registryPath)).toBe(true);
      const registry = JSON.parse(require('fs').readFileSync(registryPath, 'utf-8'));
      const entries = Object.values(registry.deployments) as Array<{
        mode: string;
        pinnedSkills: string[];
      }>;
      expect(entries).toHaveLength(1);
      expect(entries[0].pinnedSkills).toEqual(['official/anthropic/skills/code-review']);
    });

    it('--refresh updates global registry lastDeployedAt', async () => {
      writeGroupsJson({ dev: ['custom/my-skill'] });
      mkdirSync(join(testProjectDir, '.skills-manager'), { recursive: true });
      writeFileSync(
        join(testProjectDir, '.skills-manager', 'deployment.json'),
        JSON.stringify({
          mode: 'link',
          followGroups: ['dev'],
          pinnedSkills: [],
          deployedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const realProjectDir = require('fs').realpathSync(testProjectDir);
      writeFileSync(
        join(testManagerDir, 'deployments.json'),
        JSON.stringify({
          version: '1.0',
          deployments: {
            [realProjectDir]: {
              mode: 'link',
              followGroups: ['dev'],
              pinnedSkills: [],
              lastDeployedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        }),
      );

      await executeDeploy({ refresh: true });

      const registry = JSON.parse(
        require('fs').readFileSync(join(testManagerDir, 'deployments.json'), 'utf-8'),
      );
      expect(registry.deployments[realProjectDir].lastDeployedAt).not.toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });

    it('--refresh warns on missing follow group and skips it', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mkdirSync(join(testProjectDir, '.skills-manager'), { recursive: true });
      writeFileSync(
        join(testProjectDir, '.skills-manager', 'deployment.json'),
        JSON.stringify({
          mode: 'link',
          followGroups: ['gone'],
          pinnedSkills: ['custom/my-skill'],
          deployedAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      await executeDeploy({ refresh: true });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("follow group 'gone' does not exist"),
      );
      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'my-skill'))).toBe(true);
    });
  });
});

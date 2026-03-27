import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

vi.mock('./install.js', () => ({
  installSource: vi.fn(),
}));

vi.mock('./init.js', () => ({
  executeInit: vi.fn(),
}));

vi.mock('./setup.js', () => ({
  executeSetup: vi.fn(),
}));

import { executeAdd } from './add.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { installSource } from './install.js';
import { executeInit } from './init.js';
import * as constants from '../constants.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { executeRemove } from './remove.js';

describe('add command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-add-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-add-test-proj-${id}`);

    mkdirSync(join(testManagerDir, 'official'), { recursive: true });
    mkdirSync(join(testManagerDir, 'community'), { recursive: true });
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createSkill(relativePath: string, name: string, description = ''): void {
    const fullPath = join(testManagerDir, relativePath, name);
    mkdirSync(fullPath, { recursive: true });
    writeFileSync(
      join(fullPath, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${description}\n---\n`
    );
  }

  function deploySkillAsLink(skillName: string, sourcePath: string): void {
    const targetPath = join(testProjectDir, '.agents', 'skills', skillName);
    symlinkSync(sourcePath, targetPath);
  }

  describe('no argument → init flow', () => {
    it('calls executeInit when no arg provided', async () => {
      await executeAdd(undefined, {});
      expect(executeInit).toHaveBeenCalledWith({ copy: undefined });
    });

    it('passes --copy to executeInit', async () => {
      await executeAdd(undefined, { copy: true });
      expect(executeInit).toHaveBeenCalledWith({ copy: true });
    });
  });

  describe('skill name flow', () => {
    it('finds and deploys a skill by name', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');

      vi.mocked(interactiveCheckbox).mockResolvedValue(['agents-skills-standard']);

      await executeAdd('code-review', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ code-review')
      );
    });

    it('exits with message when skill not found', async () => {
      const exitError = new Error('process.exit');
      vi.mocked(process.exit).mockImplementation(() => { throw exitError; });
      vi.mocked(installSource).mockRejectedValue(new Error('Directory ./nonexistent not found. For remote install, use owner/repo format.'));

      await expect(executeAdd('nonexistent', {})).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith(
        'Error: Directory ./nonexistent not found. For remote install, use owner/repo format.'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('reports already deployed skill', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);

      vi.mocked(interactiveCheckbox).mockResolvedValue(['agents-skills-standard']);

      await executeAdd('code-review', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('· code-review (already deployed)')
      );
    });
  });

  describe('provider/repo flow', () => {
    it('matches existing repo in central repository', async () => {
      createSkill('community/someuser/somerepo', 'skill-a', 'Skill A');
      createSkill('community/someuser/somerepo', 'skill-b', 'Skill B');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['skill-a'])
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('someuser/somerepo', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });

    it('matches official provider by owner name', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['tdd'])
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('anthropics/skills', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ tdd')
      );
    });

    it('shows all deployed as message when all are deployed', async () => {
      createSkill('community/user/repo', 'only-skill', 'Only skill');
      const sourcePath = join(testManagerDir, 'community', 'user', 'repo', 'only-skill');
      deploySkillAsLink('only-skill', sourcePath);

      await executeAdd('user/repo', {});

      expect(console.log).toHaveBeenCalledWith(
        'All skills from this source are already deployed.'
      );
    });

    it('falls back to remote install when not in central repo', async () => {
      vi.mocked(installSource).mockResolvedValue({
        basePath: join(testManagerDir, 'community', 'unknown', 'repo'),
        sourceKey: 'community/unknown/repo',
      });

      // installSource creates the skills, simulate that
      vi.mocked(installSource).mockImplementation(async () => {
        createSkill('community/unknown/repo', 'remote-skill', 'Remote skill');
        return {
          basePath: join(testManagerDir, 'community', 'unknown', 'repo'),
          sourceKey: 'community/unknown/repo',
        };
      });

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['remote-skill'])
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('unknown/repo', {});

      expect(installSource).toHaveBeenCalledWith('unknown/repo', {
        all: true,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ remote-skill')
      );
    });
  });

  describe('URL flow', () => {
    it('installs directly from URL without checking central repo', async () => {
      vi.mocked(installSource).mockImplementation(async () => {
        createSkill('community/owner/repo', 'url-skill', 'URL skill');
        return {
          basePath: join(testManagerDir, 'community', 'owner', 'repo'),
          sourceKey: 'community/owner/repo',
        };
      });

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['url-skill'])
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('https://github.com/owner/repo', {});

      expect(installSource).toHaveBeenCalledWith('https://github.com/owner/repo', {
        all: true,
      });
    });
  });

  describe('-a / -s flags', () => {
    it('uses specified agent from -a flag', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');

      await executeAdd('code-review', { agent: ['claude-code'] });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ code-review')
      );
      // Should NOT have shown the agent selection UI
      expect(interactiveCheckbox).not.toHaveBeenCalled();
    });

    it('uses configured agents from -s flag', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');

      // Create symlink to simulate configured claude-code
      const claudeSkillsDir = join(testProjectDir, '.claude', 'skills');
      mkdirSync(join(testProjectDir, '.claude'), { recursive: true });
      symlinkSync(join(testProjectDir, '.agents', 'skills'), claudeSkillsDir);

      await executeAdd('code-review', { sameAgents: true });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ code-review')
      );
    });

    it('rejects -a and -s together', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');

      await executeAdd('code-review', { agent: ['claude-code'], sameAgents: true });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        'Cannot use --agent and --same-agents together.'
      );
    });

    it('rejects invalid agent name', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');

      await executeAdd('code-review', { agent: ['invalid-agent'] });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Unknown agent: 'invalid-agent'")
      );
    });
  });

  describe('--group batch deploy', () => {
    it('rejects --group with a skill argument', async () => {
      await executeAdd('some-skill', { group: 'dev' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        'Cannot use --group with a skill argument.'
      );
    });

    it('deploys skills from group', async () => {
      createSkill('custom/dev', 'skill-a', 'Skill A');
      createSkill('custom/dev', 'skill-b', 'Skill B');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['skill-a'])
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd(undefined, { group: 'dev' });

      // Should not call executeInit (group takes priority)
      expect(executeInit).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });

    it('exits when group has no skills', async () => {
      await executeAdd(undefined, { group: 'nonexistent' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        "No skills found in group 'nonexistent'."
      );
    });
  });

  describe('-g / --global flag', () => {
    it('-g without arg delegates to init with global flag', async () => {
      await executeAdd(undefined, { global: true });

      const { executeInit } = await import('./init.js');
      expect(executeInit).toHaveBeenCalledWith({ copy: undefined, global: true });
    });

    it('add -g deploys and remove -g cleans up', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      // add globally
      await executeAdd('code-review', { global: true, agent: [agent] });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ code-review')
      );
      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);

      // remove globally
      await executeRemove('code-review', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
    });

    it('does not check already-deployed for global mode', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      await executeAdd('code-review', { global: true, agent: [agent] });

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('already deployed')
      );

      // cleanup
      await executeRemove('code-review', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
    });

    it('--group with -g deploys and cleans up', async () => {
      createSkill('custom/dev', 'skill-a', 'Skill A');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['skill-a'])
        .mockResolvedValueOnce([agent]);

      await executeAdd(undefined, { global: true, group: 'dev' });

      expect(executeInit).not.toHaveBeenCalled();
      expect(existsSync(join(globalDir, 'skill-a'))).toBe(true);

      // cleanup
      await executeRemove('skill-a', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'skill-a'))).toBe(false);
    });
  });

  describe('rollback', () => {
    it('rolls back when no skills selected after remote install', async () => {
      const installPath = join(testManagerDir, 'community', 'owner', 'repo');

      vi.mocked(installSource).mockImplementation(async () => {
        createSkill('community/owner/repo', 'some-skill', 'Some skill');
        return {
          basePath: installPath,
          sourceKey: 'community/owner/repo',
        };
      });

      // User selects no skills
      vi.mocked(interactiveCheckbox).mockResolvedValueOnce([]);

      await executeAdd('owner/repo', {});

      expect(console.log).toHaveBeenCalledWith('Installation rolled back.');
    });
  });
});

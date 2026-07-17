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

vi.mock('./deploy.js', () => ({
  executeDeploy: vi.fn(),
}));

vi.mock('./setup.js', () => ({
  executeSetup: vi.fn(),
  ensureSetup: vi.fn(),
}));

import { executeAdd } from './add.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { installSource } from './install.js';
import { executeDeploy } from './deploy.js';
import * as constants from '../constants.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { executeRemove } from './remove.js';
import { GroupsService } from '../services/groups.js';

describe('add command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let testGlobalDir: string;
  let originalCwd: typeof process.cwd;
  const savedGlobalDirs = new Map<string, string>();

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-add-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-add-test-proj-${id}`);
    testGlobalDir = join(tmpdir(), `skillsmgr-add-test-global-${id}`);

    mkdirSync(join(testManagerDir, 'official'), { recursive: true });
    mkdirSync(join(testManagerDir, 'community'), { recursive: true });
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });
    mkdirSync(testGlobalDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    savedGlobalDirs.set('claude-code', TOOL_CONFIGS['claude-code'].globalSkillsDir);
    (TOOL_CONFIGS['claude-code'] as { globalSkillsDir: string }).globalSkillsDir = join(
      testGlobalDir,
      'claude-code',
    );

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.cwd = originalCwd;
    for (const [name, dir] of savedGlobalDirs) {
      (TOOL_CONFIGS[name as keyof typeof TOOL_CONFIGS] as { globalSkillsDir: string }).globalSkillsDir = dir;
    }
    savedGlobalDirs.clear();
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    rmSync(testGlobalDir, { recursive: true, force: true });
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

  describe('no argument → add-only flow with locked deployed skills', () => {
    it('shows all skills with deployed ones locked', async () => {
      createSkill('official/anthropic/skills', 'commit', 'Commit skill');
      createSkill('official/anthropic/skills', 'review', 'Review skill');
      const commitPath = join(testManagerDir, 'official/anthropic/skills/commit');
      deploySkillAsLink('commit', commitPath);

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['review']);

      await executeAdd(undefined, {});

      const call = vi.mocked(interactiveCheckbox).mock.calls[1];
      expect(call[0].message).toBe('Select skills to add (use deploy/remove to remove):');
      const commitChoice = call[0].choices.find((c: { name: string }) => c.name === 'commit');
      const reviewChoice = call[0].choices.find((c: { name: string }) => c.name === 'review');
      expect(commitChoice?.locked).toBe(true);
      expect(commitChoice?.checked).toBe(true);
      expect(reviewChoice?.locked).toBeFalsy();
    });

    it('only deploys new skills, not already deployed ones', async () => {
      createSkill('official/anthropic/skills', 'commit', 'Commit');
      createSkill('official/anthropic/skills', 'review', 'Review');
      const commitPath = join(testManagerDir, 'official/anthropic/skills/commit');
      deploySkillAsLink('commit', commitPath);

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['commit', 'review']);

      await executeAdd(undefined, {});

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('✓ review'));
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('✓ commit'));
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

    it('exits with message when skill not found and not a group', async () => {
      const exitError = new Error('process.exit');
      vi.mocked(process.exit).mockImplementation(() => { throw exitError; });

      await expect(executeAdd('nonexistent', {})).rejects.toThrow('process.exit');

      expect(installSource).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Skill or group 'nonexistent' not found"),
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('dispatches to group batch deploy and skips skill picker for bare group name', async () => {
      createSkill('custom/openspec', 'openspec-apply', 'Apply');
      createSkill('custom/openspec', 'openspec-archive', 'Archive');

      const groups = new GroupsService();
      groups.createGroup('openspec');
      groups.addSkill('openspec', 'custom/openspec/openspec-apply');
      groups.addSkill('openspec', 'custom/openspec/openspec-archive');

      vi.mocked(interactiveCheckbox).mockResolvedValue(['agents-skills-standard']);

      await executeAdd('openspec', {});

      expect(installSource).not.toHaveBeenCalled();
      expect(interactiveCheckbox).toHaveBeenCalledTimes(1);
      expect(vi.mocked(interactiveCheckbox).mock.calls[0][0].message).toContain('agent');
      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'openspec-apply'))).toBe(true);
      expect(existsSync(join(testProjectDir, '.agents', 'skills', 'openspec-archive'))).toBe(true);
    });

    it('reports already deployed skill and ensures agents', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);

      vi.mocked(interactiveCheckbox).mockResolvedValue(['agents-skills-standard']);

      await executeAdd('code-review', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('· code-review (already deployed')
      );
    });
  });

  describe('provider/repo flow', () => {
    it('matches existing repo in central repository', async () => {
      createSkill('community/someuser/somerepo', 'skill-a', 'Skill A');
      createSkill('community/someuser/somerepo', 'skill-b', 'Skill B');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd('someuser/somerepo', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });

    it('uses virtual groups in repo skill selection', async () => {
      createSkill('community/someuser/somerepo', 'skill-a', 'Skill A');
      const groupsService = new GroupsService();
      groupsService.addSkill('dev', 'community/someuser/somerepo/skill-a');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd('someuser/somerepo', {});

      expect(interactiveCheckbox).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Select skills to add (use deploy/remove to remove):',
        choices: expect.arrayContaining([
          expect.objectContaining({
            name: 'skill-a',
            subGroup: 'dev',
          }),
        ]),
      }));
    });

    it('matches official provider by owner name', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['tdd']);

      await executeAdd('anthropics/skills', {});

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ tdd')
      );
    });

    it('shows all deployed as message when all are deployed', async () => {
      createSkill('community/user/repo', 'only-skill', 'Only skill');
      const sourcePath = join(testManagerDir, 'community', 'user', 'repo', 'only-skill');
      deploySkillAsLink('only-skill', sourcePath);

      vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['agents-skills-standard']);

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
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['remote-skill']);

      await executeAdd('unknown/repo', {});

      expect(installSource).toHaveBeenCalledWith('unknown/repo', {
        all: true,
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ remote-skill')
      );
    });

    it('falls back to remote install when --skill specifies a skill not in local repo', async () => {
      createSkill('community/user/repo', 'skill-a', 'Skill A');
      const sourcePath = join(testManagerDir, 'community', 'user', 'repo', 'skill-a');
      deploySkillAsLink('skill-a', sourcePath);

      vi.mocked(installSource).mockImplementation(async () => {
        createSkill('community/user/repo', 'skill-b', 'Skill B');
        return {
          basePath: join(testManagerDir, 'community', 'user', 'repo'),
          sourceKey: 'community/user/repo',
        };
      });

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('user/repo', { skill: ['skill-b'] });

      expect(installSource).toHaveBeenCalledWith('user/repo', {
        all: false,
        skill: ['skill-b'],
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-b')
      );
    });

    it('uses local path when --skill specifies a skill already in local repo', async () => {
      createSkill('community/user/repo', 'skill-a', 'Skill A');
      createSkill('community/user/repo', 'skill-b', 'Skill B');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('user/repo', { skill: ['skill-a'] });

      expect(installSource).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });

    it('shows no new skills when --skill specifies already deployed skill', async () => {
      createSkill('community/user/repo', 'skill-a', 'Skill A');
      createSkill('community/user/repo', 'skill-b', 'Skill B');
      const sourcePath = join(testManagerDir, 'community', 'user', 'repo', 'skill-a');
      deploySkillAsLink('skill-a', sourcePath);

      vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['agents-skills-standard']);

      await executeAdd('user/repo', { skill: ['skill-a'] });

      expect(installSource).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('No new skills selected.');
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
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['url-skill']);

      await executeAdd('https://github.com/owner/repo', {});

      expect(installSource).toHaveBeenCalledWith('https://github.com/owner/repo', {
        all: true,
      });
    });

    it('uses virtual groups after remote install', async () => {
      vi.mocked(installSource).mockImplementation(async () => {
        createSkill('community/owner/repo', 'url-skill', 'URL skill');
        const groupsService = new GroupsService();
        groupsService.addSkill('remote', 'community/owner/repo/url-skill');
        return {
          basePath: join(testManagerDir, 'community', 'owner', 'repo'),
          sourceKey: 'community/owner/repo',
        };
      });

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['url-skill']);

      await executeAdd('https://github.com/owner/repo', {});

      expect(interactiveCheckbox).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Select skills to add (use deploy/remove to remove):',
        choices: expect.arrayContaining([
          expect.objectContaining({
            name: 'url-skill',
            subGroup: 'remote',
          }),
        ]),
      }));
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

    it('deploys Codex through the standard without creating a Codex bridge', async () => {
      createSkill('custom', 'codex-skill', 'Codex skill');
      writeFileSync(
        join(testManagerDir, 'custom', 'codex-skill', 'skill.json'),
        JSON.stringify({
          name: 'codex-skill',
          version: '1.0.0',
          description: 'Codex skill',
          targetAgents: ['codex'],
        }),
      );

      await executeAdd('codex-skill', {
        agent: ['agents-skills-standard'],
      });

      expect(existsSync(join(
        testProjectDir,
        '.agents',
        'skills',
        'codex-skill',
      ))).toBe(true);
      expect(existsSync(join(testProjectDir, '.codex', 'skills'))).toBe(false);
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

  describe('--group batch deploy (virtual groups)', () => {
    it('rejects --group with a skill argument', async () => {
      await executeAdd('some-skill', { group: 'dev' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        'Cannot use --group with a skill argument.'
      );
    });

    it('deploys skills from virtual group', async () => {
      createSkill('custom', 'skill-a', 'Skill A');
      createSkill('custom', 'skill-b', 'Skill B');

      const groupsService = new GroupsService();
      groupsService.addSkill('dev', 'custom/skill-a');
      groupsService.addSkill('dev', 'custom/skill-b');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd(undefined, { group: 'dev' });

      expect(executeDeploy).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });

    it('uses virtual groups in --group selection', async () => {
      createSkill('custom', 'skill-a', 'Skill A');

      const groupsService = new GroupsService();
      groupsService.addSkill('dev', 'custom/skill-a');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd(undefined, { group: 'dev' });

      expect(interactiveCheckbox).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Select skills to add (use deploy/remove to remove):',
        choices: expect.arrayContaining([
          expect.objectContaining({
            name: 'skill-a',
            subGroup: 'dev',
          }),
        ]),
      }));
    });

    it('exits when group has no skills', async () => {
      await executeAdd(undefined, { group: 'nonexistent' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        "No skills found in group 'nonexistent'."
      );
    });

    it('skips dangling references in group', async () => {
      createSkill('custom', 'skill-a', 'Skill A');

      const groupsService = new GroupsService();
      groupsService.addSkill('dev', 'custom/skill-a');
      groupsService.addSkill('dev', 'custom/deleted-skill');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd(undefined, { group: 'dev' });

      expect(console.log).toHaveBeenCalledWith(
        "Skill 'custom/deleted-skill' not found, skipping."
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ skill-a')
      );
    });
  });

  describe('-g / --global flag', () => {
    it('-g without arg shows add-only flow with global mode', async () => {
      createSkill('official/anthropic/skills', 'commit', 'Commit');

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['claude-code'])
        .mockResolvedValueOnce(['commit']);

      await executeAdd(undefined, { global: true });

      const call = vi.mocked(interactiveCheckbox).mock.calls[1];
      expect(call[0].message).toBe('Select skills to add (use deploy/remove to remove):');
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
      createSkill('custom', 'skill-a', 'Skill A');

      const groupsService = new GroupsService();
      groupsService.addSkill('dev', 'custom/skill-a');

      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce([agent])
        .mockResolvedValueOnce(['skill-a']);

      await executeAdd(undefined, { global: true, group: 'dev' });

      expect(executeDeploy).not.toHaveBeenCalled();
      expect(existsSync(join(globalDir, 'skill-a'))).toBe(true);

      // cleanup
      await executeRemove('skill-a', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'skill-a'))).toBe(false);
    });
  });

  describe('add agent to already-deployed skill', () => {
    function makeBridge(symlinkDir: string): void {
      const bridgePath = join(testProjectDir, symlinkDir);
      mkdirSync(join(testProjectDir, symlinkDir, '..'), { recursive: true });
      symlinkSync(join(testProjectDir, '.agents', 'skills'), bridgePath);
    }

    it('adds claude-code bridge for already-deployed skill, leaving codex bridge and skill intact', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);
      makeBridge('.codex/skills');

      await executeAdd('code-review', { agent: ['claude-code'] });

      const claudeBridge = join(testProjectDir, '.claude', 'skills');
      const codexBridge = join(testProjectDir, '.codex', 'skills');
      const deployedSkill = join(testProjectDir, '.agents', 'skills', 'code-review');
      expect(existsSync(claudeBridge)).toBe(true);
      expect(existsSync(codexBridge)).toBe(true);
      expect(existsSync(deployedSkill)).toBe(true);
    });

    it('is idempotent when the agent bridge already exists', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);
      makeBridge('.claude/skills');

      await executeAdd('code-review', { agent: ['claude-code'] });

      const claudeBridge = join(testProjectDir, '.claude', 'skills');
      expect(existsSync(claudeBridge)).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('writes companions for the added agent on an already-deployed skill', async () => {
      const skillDir = join(testManagerDir, 'custom', 'with-companion');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        '---\nname: with-companion\ndescription: c\n---\n',
      );
      writeFileSync(join(skillDir, 'AGENTS.md'), 'companion body');
      writeFileSync(
        join(skillDir, 'skill.json'),
        JSON.stringify({
          name: 'with-companion',
          version: '1.0.0',
          description: 'c',
          companions: [
            {
              source: 'AGENTS.md',
              agentTargets: { 'claude-code': 'CLAUDE.md' },
            },
          ],
        }),
      );
      deploySkillAsLink('with-companion', skillDir);

      await executeAdd('with-companion', { agent: ['claude-code'] });

      const companionPath = join(testProjectDir, 'CLAUDE.md');
      expect(existsSync(companionPath)).toBe(true);
    });
  });

  describe('add agent without -a enters interactive selection with locked configured agents', () => {
    it('locks already-configured agents in the agent prompt for an already-deployed skill', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'Code review');
      const sourcePath = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      deploySkillAsLink('code-review', sourcePath);
      vi.mocked(interactiveCheckbox).mockResolvedValueOnce([
        'agents-skills-standard',
        'claude-code',
      ]);

      await executeAdd('code-review', {});

      const agentCall = vi.mocked(interactiveCheckbox).mock.calls[0];
      expect(agentCall[0].message).toContain('agent');
      const standardChoice = agentCall[0].choices.find(
        (c: { value: string }) => c.value === 'agents-skills-standard',
      );
      expect(standardChoice?.name).toContain('Codex');
      expect(standardChoice?.locked).toBe(true);
      expect(standardChoice?.checked).toBe(true);
      expect(agentCall[0].choices.some(
        (c: { value: string }) => c.value === 'codex',
      )).toBe(false);
      // claude-code newly added → bridge created
      expect(existsSync(join(testProjectDir, '.claude', 'skills'))).toBe(true);
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

      // Agent selection then user selects no skills
      vi.mocked(interactiveCheckbox)
        .mockResolvedValueOnce(['agents-skills-standard'])
        .mockResolvedValueOnce([]);

      await executeAdd('owner/repo', {});

      expect(console.log).toHaveBeenCalledWith('Installation rolled back.');
    });
  });
});

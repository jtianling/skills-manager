import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';
import { GroupsService } from '../services/groups.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
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

describe('remove command', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let testGlobalDir: string;
  let originalCwd: typeof process.cwd;
  const savedGlobalDirs = new Map<string, string>();

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-remove-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-remove-test-proj-${id}`);
    testGlobalDir = join(tmpdir(), `skillsmgr-remove-test-global-${id}`);

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

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
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

  it('removes a deployed skill', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    await executeRemove('code-review', {});

    expect(existsSync(deployedPath)).toBe(false);
  });

  it('exits when skill not found in deployed skills', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('nonexistent', {})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits when no skills deployed', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('anything', {})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('removes skill via --skill flag', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    await executeRemove(undefined, { skill: ['code-review'] });

    expect(existsSync(deployedPath)).toBe(false);
  });

  it('merges positional arg with --skill flag', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath1 = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath1);

    mkdirSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'tdd'), { recursive: true });
    writeFileSync(
      join(testManagerDir, 'official', 'anthropic', 'skills', 'tdd', 'SKILL.md'),
      '---\nname: tdd\ndescription: test\n---\n',
    );
    const skillSource2 = join(testManagerDir, 'official', 'anthropic', 'skills', 'tdd');
    const deployedPath2 = join(testProjectDir, '.agents', 'skills', 'tdd');
    symlinkSync(skillSource2, deployedPath2);

    await executeRemove('code-review', { skill: ['tdd'] });

    expect(existsSync(deployedPath1)).toBe(false);
    expect(existsSync(deployedPath2)).toBe(false);
  });

  it('shows no skills message when no args and no deployed skills', async () => {
    await executeRemove(undefined, {});

    expect(console.log).toHaveBeenCalledWith('No skills deployed in current project.');
  });

  it('deduplicates positional arg and --skill', async () => {
    const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
    const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
    symlinkSync(skillSource, deployedPath);

    await executeRemove('code-review', { skill: ['code-review'] });

    expect(existsSync(deployedPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed code-review');
  });

  it('removes deployed skills from a virtual group with --group --all', async () => {
    const skillA = createSkill(testManagerDir, 'custom', 'skill-a');
    const skillB = createSkill(testManagerDir, 'custom', 'skill-b');
    const skillC = createSkill(testManagerDir, 'custom', 'skill-c');
    const deployedA = join(testProjectDir, '.agents', 'skills', 'skill-a');
    const deployedB = join(testProjectDir, '.agents', 'skills', 'skill-b');
    const deployedC = join(testProjectDir, '.agents', 'skills', 'skill-c');
    symlinkSync(skillA, deployedA);
    symlinkSync(skillB, deployedB);
    symlinkSync(skillC, deployedC);

    const groupsService = new GroupsService();
    groupsService.addSkill('dev', 'custom/skill-a');
    groupsService.addSkill('dev', 'custom/skill-b');
    groupsService.addSkill('other', 'custom/skill-c');

    await executeRemove(undefined, { group: 'dev', all: true });

    expect(existsSync(deployedA)).toBe(false);
    expect(existsSync(deployedB)).toBe(false);
    expect(existsSync(deployedC)).toBe(true);
    expect(groupsService.getGroupMembers('dev')).toEqual([]);
    expect(groupsService.getGroupMembers('other')).toEqual(['custom/skill-c']);
  });

  it('supports --group with -g and cleans group references', async () => {
    createSkill(testManagerDir, 'custom', 'skill-a');
    createSkill(testManagerDir, 'custom', 'skill-b');
    const globalA = join(TOOL_CONFIGS['claude-code'].globalSkillsDir, 'skill-a');
    mkdirSync(globalA, { recursive: true });
    writeFileSync(join(globalA, 'SKILL.md'), '---\nname: skill-a\ndescription: test\n---\n');

    const groupsService = new GroupsService();
    groupsService.addSkill('dev', 'custom/skill-a');
    groupsService.addSkill('dev', 'custom/skill-b');

    await executeRemove(undefined, {
      group: 'dev',
      global: true,
      agent: ['claude-code'],
      all: true,
    });

    expect(existsSync(globalA)).toBe(false);
    expect(groupsService.getGroupMembers('dev')).toEqual(['custom/skill-b']);
  });

  it('exits when group does not exist', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove(undefined, { group: 'missing' })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith("Group 'missing' not found.");
  });

  it('exits when group has no deployed skills', async () => {
    createSkill(testManagerDir, 'custom', 'skill-a');
    const groupsService = new GroupsService();
    groupsService.addSkill('dev', 'custom/skill-a');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove(undefined, { group: 'dev' })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith("No deployed skills found in group 'dev'.");
  });

  it('exits when --group is used with a skill argument', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('skill-a', { group: 'dev' })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith('Cannot use --group with skill name argument.');
  });

  describe('remove --agent in project mode (bridge teardown)', () => {
    function makeBridge(symlinkDir: string): string {
      const bridgePath = join(testProjectDir, symlinkDir);
      mkdirSync(join(bridgePath, '..'), { recursive: true });
      symlinkSync(join(testProjectDir, '.agents', 'skills'), bridgePath);
      return bridgePath;
    }

    it('removes only the targeted agent bridge, leaving other bridge and skills intact', async () => {
      const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
      symlinkSync(skillSource, deployedPath);
      const claudeBridge = makeBridge('.claude/skills');
      const codexBridge = makeBridge('.codex/skills');

      await executeRemove('code-review', { agent: ['claude-code'] });

      expect(existsSync(claudeBridge)).toBe(false);
      expect(existsSync(codexBridge)).toBe(true);
      expect(existsSync(deployedPath)).toBe(true);
    });

    it('is a no-op with notice when the targeted agent has no bridge', async () => {
      const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
      symlinkSync(skillSource, deployedPath);
      const codexBridge = makeBridge('.codex/skills');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await executeRemove('code-review', { agent: ['claude-code'] });

      expect(mockExit).not.toHaveBeenCalled();
      expect(existsSync(codexBridge)).toBe(true);
      expect(existsSync(deployedPath)).toBe(true);
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('will lose access to ALL skills'),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('has no bridge configured'),
      );
    });

    it('without --agent still removes the skill from .agents/skills', async () => {
      const skillSource = join(testManagerDir, 'official', 'anthropic', 'skills', 'code-review');
      const deployedPath = join(testProjectDir, '.agents', 'skills', 'code-review');
      symlinkSync(skillSource, deployedPath);
      const codexBridge = makeBridge('.codex/skills');

      await executeRemove('code-review', {});

      expect(existsSync(deployedPath)).toBe(false);
      expect(existsSync(codexBridge)).toBe(true);
    });
  });

  it('shows virtual groups in interactive remove choices', async () => {
    const skillA = createSkill(testManagerDir, 'custom', 'skill-a');
    const skillB = createSkill(testManagerDir, 'custom', 'skill-b');
    const skillC = createSkill(testManagerDir, 'custom', 'skill-c');
    symlinkSync(skillA, join(testProjectDir, '.agents', 'skills', 'skill-a'));
    symlinkSync(skillB, join(testProjectDir, '.agents', 'skills', 'skill-b'));
    symlinkSync(skillC, join(testProjectDir, '.agents', 'skills', 'skill-c'));

    const groupsService = new GroupsService();
    groupsService.addSkill('alpha', 'custom/skill-a');
    groupsService.addSkill('beta', 'custom/skill-b');

    await executeRemove(undefined, {});

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: 'Select skills to remove:',
      choices: [
        {
          name: 'skill-a',
          description: undefined,
          value: 'skill-a',
          suffix: undefined,
          locked: undefined,
          subGroup: 'alpha',
        },
        {
          name: 'skill-b',
          description: undefined,
          value: 'skill-b',
          suffix: undefined,
          locked: undefined,
          subGroup: 'beta',
        },
        {
          name: 'skill-c',
          description: undefined,
          value: 'skill-c',
          suffix: undefined,
          locked: undefined,
          subGroup: undefined,
        },
      ],
    });
  });
});

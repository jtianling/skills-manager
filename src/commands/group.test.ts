import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { GroupsService } from '../services/groups.js';
import type { SkillInfo } from '../types.js';

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

vi.mock('../utils/prompts.js', () => ({
  getSourceSuffix: vi.fn((source: string) => source),
  promptGroupAddConflictResolution: vi.fn(),
  promptSelect: vi.fn(),
}));

import {
  checkNameConflict,
  executeGroupAdd,
  executeGroupRemove,
  executeGroupRename,
  resolveGroupAddIdentifier,
} from './group.js';
import {
  promptGroupAddConflictResolution,
  promptSelect,
} from '../utils/prompts.js';

function createSkill(
  managerDir: string,
  source: string,
  skillName: string,
  declaredName = skillName,
): string {
  const skillDir = join(managerDir, source, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${declaredName}\ndescription: test\n---\n`,
  );
  return skillDir;
}

describe('group command integration', () => {
  let testDir: string;
  let service: GroupsService;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `skillsmgr-group-cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });
    service = new GroupsService();

    createSkill(testDir, 'official/anthropic/skills', 'commit');
    createSkill(testDir, 'custom', 'my-linter');
    createSkill(testDir, 'custom', 'openspec');
    createSkill(testDir, 'community/obra/superpowers', 'alpha');
    createSkill(testDir, 'community/obra/superpowers', 'beta');
    createSkill(testDir, 'custom/alt', 'commit');

    vi.mocked(promptSelect).mockReset();
    vi.mocked(promptGroupAddConflictResolution).mockReset();
    vi.mocked(promptGroupAddConflictResolution).mockResolvedValue('replace');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('name conflict detection', () => {
    it('returns conflicting key when names match and keys differ', () => {
      const conflict = checkNameConflict(
        ['custom/alt/commit', 'custom/my-linter'],
        'official/anthropic/skills/commit',
      );

      expect(conflict).toBe('custom/alt/commit');
    });

    it('returns null when key already exists or no name conflict', () => {
      expect(
        checkNameConflict(
          ['official/anthropic/skills/commit'],
          'official/anthropic/skills/commit',
        ),
      ).toBeNull();

      expect(
        checkNameConflict(
          ['custom/my-linter'],
          'official/anthropic/skills/commit',
        ),
      ).toBeNull();
    });
  });

  describe('identifier resolution', () => {
    it('resolves full key directly', async () => {
      const allSkills: SkillInfo[] = [
        {
          name: 'commit',
          description: '',
          path: join(testDir, 'official', 'anthropic', 'skills', 'commit'),
          source: 'official/anthropic/skills',
        },
      ];

      const result = await resolveGroupAddIdentifier(
        'official/anthropic/skills/commit',
        'python',
        allSkills,
        service,
      );

      expect(result.type).toBe('skill');
      expect(result.type === 'skill' ? result.skill.source : '').toBe('official/anthropic/skills');
      expect(promptSelect).not.toHaveBeenCalled();
    });

    it('prompts when identifier matches both skill and group', async () => {
      service.addSkill('openspec', 'official/anthropic/skills/commit');
      vi.mocked(promptSelect).mockResolvedValue('group:openspec');

      const allSkills: SkillInfo[] = [
        {
          name: 'openspec',
          description: '',
          path: join(testDir, 'custom', 'openspec'),
          source: 'custom',
        },
      ];

      const result = await resolveGroupAddIdentifier(
        'openspec',
        'develop',
        allSkills,
        service,
      );

      expect(promptSelect).toHaveBeenCalledWith('Which one?', [
        {
          name: 'skill: openspec (custom/openspec)',
          value: 'skill:custom/openspec',
        },
        {
          name: 'group: openspec (1 skills)',
          value: 'group:openspec',
        },
      ]);
      expect(result.type).toBe('group');
    });

    it('resolves owner/repo to repo candidate', async () => {
      const allSkills: SkillInfo[] = [];

      const result = await resolveGroupAddIdentifier(
        'obra/superpowers',
        'develop',
        allSkills,
        service,
      );

      expect(result.type).toBe('repo');
      expect(result.type === 'repo' ? result.ownerRepo : '').toBe('obra/superpowers');
    });

    it('throws self reference error when only matching group is target group', async () => {
      service.addSkill('develop', 'official/anthropic/skills/commit');

      await expect(
        resolveGroupAddIdentifier('develop', 'develop', [], service),
      ).rejects.toThrow('Cannot add a group to itself.');
    });
  });

  describe('group add', () => {
    it('adds skills from another group in batch and skips existing keys', async () => {
      service.addSkill('sourcegroup', 'official/anthropic/skills/commit');
      service.addSkill('sourcegroup', 'custom/my-linter');
      service.addSkill('develop', 'custom/my-linter');

      await executeGroupAdd('develop', 'sourcegroup');

      expect(service.getGroupMembers('develop')).toEqual([
        'custom/my-linter',
        'official/anthropic/skills/commit',
      ]);
      expect(console.log).toHaveBeenCalledWith(
        "Added 1 skills from group 'sourcegroup' to 'develop':",
      );
      expect(console.log).toHaveBeenCalledWith('  ✓ commit');
      expect(console.log).toHaveBeenCalledWith('  · my-linter (already in develop, skipped)');
    });

    it('adds all installed skills from owner/repo in batch', async () => {
      await executeGroupAdd('develop', 'obra/superpowers');

      expect(service.getGroupMembers('develop')).toEqual([
        'community/obra/superpowers/alpha',
        'community/obra/superpowers/beta',
      ]);
      expect(console.log).toHaveBeenCalledWith(
        "Added 2 skills from repo 'obra/superpowers' to 'develop':",
      );
      expect(console.log).toHaveBeenCalledWith('  ✓ alpha');
      expect(console.log).toHaveBeenCalledWith('  ✓ beta');
    });

    it('does not count replaced skills in batch summary', async () => {
      service.addSkill('sourcegroup', 'official/anthropic/skills/commit');
      service.addSkill('develop', 'custom/alt/commit');
      vi.mocked(promptGroupAddConflictResolution).mockResolvedValueOnce('replace');

      await executeGroupAdd('develop', 'sourcegroup');

      expect(service.getGroupMembers('develop')).toEqual(['official/anthropic/skills/commit']);
      expect(console.log).toHaveBeenCalledWith(
        "Added 0 skills from group 'sourcegroup' to 'develop':",
      );
      expect(console.log).toHaveBeenCalledWith(
        '  ⚠ commit (name conflict with custom/alt/commit, replaced)',
      );
    });

    it('replaces conflicting skill when user chooses replace', async () => {
      service.addSkill('develop', 'custom/alt/commit');
      vi.mocked(promptGroupAddConflictResolution).mockResolvedValueOnce('replace');

      await executeGroupAdd('develop', 'official/anthropic/skills/commit');

      expect(promptGroupAddConflictResolution).toHaveBeenCalledWith(
        'develop',
        'custom/alt/commit',
        'official/anthropic/skills/commit',
      );
      expect(service.getGroupMembers('develop')).toEqual(['official/anthropic/skills/commit']);
      expect(console.log).toHaveBeenCalledWith(
        "Replaced 'custom/alt/commit' with 'official/anthropic/skills/commit' in group 'develop'.",
      );
    });

    it('skips conflicting skill when user chooses skip', async () => {
      service.addSkill('develop', 'custom/alt/commit');
      vi.mocked(promptGroupAddConflictResolution).mockResolvedValueOnce('skip');

      await executeGroupAdd('develop', 'official/anthropic/skills/commit');

      expect(service.getGroupMembers('develop')).toEqual(['custom/alt/commit']);
      expect(console.log).toHaveBeenCalledWith(
        "Skipped 'official/anthropic/skills/commit' due to name conflict with 'custom/alt/commit' in group 'develop'.",
      );
    });

    it('exits when adding a group to itself', async () => {
      service.addSkill('develop', 'official/anthropic/skills/commit');

      await expect(executeGroupAdd('develop', 'develop')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith('Cannot add a group to itself.');
    });
  });

  describe('group create + list', () => {
    it('creates group and lists it', () => {
      service.createGroup('python');
      expect(service.listGroups()).toEqual(['python']);
    });
  });

  describe('group add with skill name resolution', () => {
    it('resolves unique skill name to full key', () => {
      service.addSkill('python', 'official/anthropic/skills/commit');
      expect(service.getGroupMembers('python')).toEqual(['official/anthropic/skills/commit']);
    });

    it('adds custom skill by name', () => {
      service.addSkill('python', 'custom/my-linter');
      expect(service.getGroupMembers('python')).toEqual(['custom/my-linter']);
    });

    it('skill can be in multiple groups', () => {
      service.addSkill('python', 'custom/my-linter');
      service.addSkill('rust', 'custom/my-linter');
      expect(service.getGroupMembers('python')).toEqual(['custom/my-linter']);
      expect(service.getGroupMembers('rust')).toEqual(['custom/my-linter']);
    });
  });

  describe('group delete', () => {
    it('deletes group without affecting skills', () => {
      service.createGroup('python');
      service.addSkill('python', 'custom/my-linter');
      service.deleteGroup('python');
      expect(service.getGroup('python')).toBeNull();
      expect(existsSync(join(testDir, 'custom', 'my-linter', 'SKILL.md'))).toBe(true);
    });
  });

  describe('group remove', () => {
    it('removes skill from group without deleting files', () => {
      service.addSkill('python', 'custom/my-linter');
      service.removeSkill('python', 'custom/my-linter');
      expect(service.getGroupMembers('python')).toEqual([]);
      expect(existsSync(join(testDir, 'custom', 'my-linter', 'SKILL.md'))).toBe(true);
    });

    it('batch removes skills by group (intersection removed, non-intersection skipped)', async () => {
      service.addSkill('develop', 'official/anthropic/skills/commit');
      service.addSkill('develop', 'custom/my-linter');
      service.addSkill('develop', 'custom/openspec');
      service.addSkill('sourcegroup', 'official/anthropic/skills/commit');
      service.addSkill('sourcegroup', 'custom/openspec');

      await executeGroupRemove('develop', 'sourcegroup');

      expect(service.getGroupMembers('develop')).toEqual(['custom/my-linter']);
      expect(console.log).toHaveBeenCalledWith(
        "Removed 2 skills from group 'sourcegroup' in 'develop':",
      );
      expect(console.log).toHaveBeenCalledWith('  · commit (removed)');
      expect(console.log).toHaveBeenCalledWith('  · openspec (removed)');
    });

    it('batch removes skills by owner/repo', async () => {
      service.addSkill('develop', 'community/obra/superpowers/alpha');
      service.addSkill('develop', 'community/obra/superpowers/beta');
      service.addSkill('develop', 'custom/my-linter');

      await executeGroupRemove('develop', 'obra/superpowers');

      expect(service.getGroupMembers('develop')).toEqual(['custom/my-linter']);
      expect(console.log).toHaveBeenCalledWith(
        "Removed 2 skills from repo 'obra/superpowers' in 'develop':",
      );
      expect(console.log).toHaveBeenCalledWith('  · alpha (removed)');
      expect(console.log).toHaveBeenCalledWith('  · beta (removed)');
    });

    it('shows empty message for empty source group', async () => {
      service.createGroup('empty-group');
      service.addSkill('develop', 'custom/my-linter');

      await executeGroupRemove('develop', 'empty-group');

      expect(console.log).toHaveBeenCalledWith(
        "Group 'empty-group' is empty, nothing to remove.",
      );
      expect(service.getGroupMembers('develop')).toEqual(['custom/my-linter']);
    });

    it('exits when removing a group from itself', async () => {
      service.addSkill('develop', 'official/anthropic/skills/commit');

      await expect(executeGroupRemove('develop', 'develop')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith('Cannot remove a group from itself.');
    });
  });

  describe('group rename', () => {
    it('renames group successfully', async () => {
      service.addSkill('python', 'custom/my-linter');

      await executeGroupRename('python', 'py-tools');

      expect(service.getGroup('python')).toBeNull();
      expect(service.getGroupMembers('py-tools')).toEqual(['custom/my-linter']);
      expect(console.log).toHaveBeenCalledWith("Renamed group 'python' to 'py-tools'.");
    });

    it('exits when old group is missing', async () => {
      await expect(executeGroupRename('nonexistent', 'new-name')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith("Group 'nonexistent' not found.");
    });

    it('exits when new group already exists', async () => {
      service.createGroup('python');
      service.createGroup('rust');

      await expect(executeGroupRename('python', 'rust')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith("Group 'rust' already exists.");
    });

    it('exits when new name is invalid', async () => {
      service.createGroup('python');

      await expect(executeGroupRename('python', 'my tools')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith(
        'Group name must contain only letters, numbers, hyphens, and underscores',
      );
    });

    it('exits when new name is the same as current name', async () => {
      service.createGroup('python');

      await expect(executeGroupRename('python', 'python')).rejects.toThrow(
        'process.exit',
      );
      expect(console.log).toHaveBeenCalledWith(
        'New name is the same as the current name.',
      );
    });
  });
});

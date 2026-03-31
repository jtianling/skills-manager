import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { GroupsService, validateGroupName } from './groups.js';
import * as constants from '../constants.js';

describe('GroupsService', () => {
  let testDir: string;
  let service: GroupsService;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-groups-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });
    service = new GroupsService();
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateGroupName', () => {
    it('accepts valid names', () => {
      expect(() => validateGroupName('python')).not.toThrow();
      expect(() => validateGroupName('python-3')).not.toThrow();
      expect(() => validateGroupName('my_tools')).not.toThrow();
      expect(() => validateGroupName('A1')).not.toThrow();
    });

    it('rejects invalid names', () => {
      expect(() => validateGroupName('my tools')).toThrow();
      expect(() => validateGroupName('a/b')).toThrow();
      expect(() => validateGroupName('a.b')).toThrow();
    });
  });

  describe('listGroups', () => {
    it('returns empty array when no groups.json', () => {
      expect(service.listGroups()).toEqual([]);
    });

    it('returns group names', () => {
      service.createGroup('python');
      service.createGroup('rust');
      expect(service.listGroups()).toEqual(['python', 'rust']);
    });
  });

  describe('getGroup', () => {
    it('returns null for nonexistent group', () => {
      expect(service.getGroup('nonexistent')).toBeNull();
    });

    it('returns skill keys array', () => {
      service.createGroup('python');
      service.addSkill('python', 'custom/my-linter');
      expect(service.getGroup('python')).toEqual(['custom/my-linter']);
    });
  });

  describe('createGroup', () => {
    it('creates empty group', () => {
      service.createGroup('frontend');
      expect(service.getGroup('frontend')).toEqual([]);
    });

    it('throws on duplicate', () => {
      service.createGroup('python');
      expect(() => service.createGroup('python')).toThrow("Group 'python' already exists.");
    });

    it('throws on invalid name', () => {
      expect(() => service.createGroup('bad name')).toThrow();
    });
  });

  describe('deleteGroup', () => {
    it('deletes group', () => {
      service.createGroup('python');
      service.deleteGroup('python');
      expect(service.getGroup('python')).toBeNull();
    });

    it('throws when group not found', () => {
      expect(() => service.deleteGroup('nonexistent')).toThrow("Group 'nonexistent' not found.");
    });
  });

  describe('renameGroup', () => {
    it('renames group and preserves skills', () => {
      service.addSkill('python', 'custom/my-linter');

      service.renameGroup('python', 'py-tools');

      expect(service.getGroup('python')).toBeNull();
      expect(service.getGroup('py-tools')).toEqual(['custom/my-linter']);
    });

    it('throws when old group not found', () => {
      expect(() => service.renameGroup('nonexistent', 'new-name')).toThrow(
        "Group 'nonexistent' not found.",
      );
    });

    it('throws when new group already exists', () => {
      service.createGroup('python');
      service.createGroup('rust');

      expect(() => service.renameGroup('python', 'rust')).toThrow(
        "Group 'rust' already exists.",
      );
    });

    it('throws when new name is invalid', () => {
      service.createGroup('python');

      expect(() => service.renameGroup('python', 'my tools')).toThrow(
        'Group name must contain only letters, numbers, hyphens, and underscores',
      );
    });

    it('throws when new name is the same as current name', () => {
      service.createGroup('python');

      expect(() => service.renameGroup('python', 'python')).toThrow(
        'New name is the same as the current name.',
      );
    });
  });

  describe('addSkill', () => {
    it('adds skill to existing group', () => {
      service.createGroup('python');
      const added = service.addSkill('python', 'custom/my-linter');
      expect(added).toBe(true);
      expect(service.getGroup('python')).toEqual(['custom/my-linter']);
    });

    it('auto-creates group if not exists', () => {
      const added = service.addSkill('new-group', 'custom/my-linter');
      expect(added).toBe(true);
      expect(service.getGroup('new-group')).toEqual(['custom/my-linter']);
    });

    it('returns false on duplicate (idempotent)', () => {
      service.addSkill('python', 'custom/my-linter');
      const added = service.addSkill('python', 'custom/my-linter');
      expect(added).toBe(false);
      expect(service.getGroup('python')).toEqual(['custom/my-linter']);
    });
  });

  describe('removeSkill', () => {
    it('removes skill from group', () => {
      service.addSkill('python', 'custom/my-linter');
      service.addSkill('python', 'official/anthropic/skills/commit');
      const removed = service.removeSkill('python', 'custom/my-linter');
      expect(removed).toBe(true);
      expect(service.getGroup('python')).toEqual(['official/anthropic/skills/commit']);
    });

    it('returns false when skill not in group', () => {
      service.createGroup('python');
      expect(service.removeSkill('python', 'nonexistent')).toBe(false);
    });

    it('returns false when group not found', () => {
      expect(service.removeSkill('nonexistent', 'anything')).toBe(false);
    });
  });

  describe('removeSkillFromAll', () => {
    it('removes from all groups', () => {
      service.addSkill('python', 'custom/my-linter');
      service.addSkill('rust', 'custom/my-linter');
      service.addSkill('rust', 'official/anthropic/skills/commit');

      service.removeSkillFromAll('custom/my-linter');

      expect(service.getGroup('python')).toEqual([]);
      expect(service.getGroup('rust')).toEqual(['official/anthropic/skills/commit']);
    });

    it('does nothing when skill not in any group', () => {
      service.createGroup('python');
      service.removeSkillFromAll('nonexistent');
      expect(service.getGroup('python')).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('persists to groups.json', () => {
      service.addSkill('python', 'custom/my-linter');
      const content = JSON.parse(readFileSync(join(testDir, 'groups.json'), 'utf-8'));
      expect(content).toEqual({ python: ['custom/my-linter'] });
    });

    it('reads existing groups.json', () => {
      writeFileSync(join(testDir, 'groups.json'), JSON.stringify({ rust: ['custom/a'] }));
      const freshService = new GroupsService();
      expect(freshService.getGroup('rust')).toEqual(['custom/a']);
    });
  });
});

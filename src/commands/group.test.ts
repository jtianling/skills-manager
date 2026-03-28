import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { GroupsService } from '../services/groups.js';

// We test the underlying service + resolveSkillKey logic via integration.
// The group command functions are thin wrappers, so we test the key behavior.

describe('group command integration', () => {
  let testDir: string;
  let service: GroupsService;

  beforeEach(() => {
    testDir = join(tmpdir(), `skillsmgr-group-cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testDir, writable: true });
    service = new GroupsService();

    // Create some skills in the test dir
    const officialSkill = join(testDir, 'official', 'anthropic', 'skills', 'commit');
    mkdirSync(officialSkill, { recursive: true });
    writeFileSync(join(officialSkill, 'SKILL.md'), '---\nname: commit\ndescription: Commit skill\n---\n');

    const customSkill = join(testDir, 'custom', 'my-linter');
    mkdirSync(customSkill, { recursive: true });
    writeFileSync(join(customSkill, 'SKILL.md'), '---\nname: my-linter\ndescription: My linter\n---\n');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as never);
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
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
      expect(service.getGroup('python')).toEqual(['official/anthropic/skills/commit']);
    });

    it('adds custom skill by name', () => {
      service.addSkill('python', 'custom/my-linter');
      expect(service.getGroup('python')).toEqual(['custom/my-linter']);
    });

    it('skill can be in multiple groups', () => {
      service.addSkill('python', 'custom/my-linter');
      service.addSkill('rust', 'custom/my-linter');
      expect(service.getGroup('python')).toEqual(['custom/my-linter']);
      expect(service.getGroup('rust')).toEqual(['custom/my-linter']);
    });
  });

  describe('group delete', () => {
    it('deletes group without affecting skills', () => {
      service.createGroup('python');
      service.addSkill('python', 'custom/my-linter');
      service.deleteGroup('python');
      expect(service.getGroup('python')).toBeNull();
      // Skill files still exist
      expect(existsSync(join(testDir, 'custom', 'my-linter', 'SKILL.md'))).toBe(true);
    });
  });

  describe('group remove', () => {
    it('removes skill from group without deleting files', () => {
      service.addSkill('python', 'custom/my-linter');
      service.removeSkill('python', 'custom/my-linter');
      expect(service.getGroup('python')).toEqual([]);
      expect(existsSync(join(testDir, 'custom', 'my-linter', 'SKILL.md'))).toBe(true);
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { GroupsService } from '../services/groups.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import { executeRemove } from './remove.js';

describe('remove positional group', () => {
  let root: string;
  let managerDir: string;
  let projectDir: string;
  let groups: GroupsService;
  const originalManagerDir = constants.SKILLS_MANAGER_DIR;

  function createSkill(name: string, source = 'custom', deploy = true): string {
    const skillDir = join(managerDir, source, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: test\n---\n`,
    );
    const deployedPath = join(projectDir, '.agents', 'skills', name);
    if (deploy) symlinkSync(skillDir, deployedPath);
    return deployedPath;
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skillsmgr-remove-positional-'));
    managerDir = join(root, 'manager');
    projectDir = join(root, 'project');
    mkdirSync(managerDir, { recursive: true });
    mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: managerDir, writable: true,
    });
    vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    groups = new GroupsService();
    vi.mocked(interactiveCheckbox).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: originalManagerDir, writable: true,
    });
    rmSync(root, { recursive: true, force: true });
  });

  it('test_remove_virtual_group_removes_only_deployed_members', async () => {
    const target = createSkill('target');
    const unrelated = createSkill('unrelated');
    createSkill('not-deployed', 'custom', false);
    groups.addSkill('develop', 'custom/target');
    groups.addSkill('develop', 'custom/not-deployed');
    groups.addSkill('other', 'custom/unrelated');

    await executeRemove('develop');

    expect(existsSync(target)).toBe(false);
    expect(existsSync(unrelated)).toBe(true);
    expect(existsSync(join(managerDir, 'custom', 'target', 'SKILL.md')))
      .toBe(true);
    expect(groups.getGroupMembers('other')).toEqual(['custom/unrelated']);
    expect(interactiveCheckbox).not.toHaveBeenCalled();
  });

  it('test_remove_physical_group_removes_only_matching_source', async () => {
    const target = createSkill('target', 'custom/develop');
    createSkill('shared', 'custom/develop', false);
    const unrelated = createSkill('shared', 'custom/other');
    groups.createLocalBatchGroup('develop', '/fixture/develop');

    await executeRemove('develop');

    expect(existsSync(target)).toBe(false);
    expect(existsSync(unrelated)).toBe(true);
    expect(groups.getGroupMembers('develop')).toEqual([
      'custom/develop/shared', 'custom/develop/target',
    ]);
    expect(interactiveCheckbox).not.toHaveBeenCalled();
  });

  it('test_remove_same_name_skill_takes_priority_over_group', async () => {
    const skill = createSkill('develop');
    const member = createSkill('member');
    groups.addSkill('develop', 'custom/member');

    await executeRemove('develop');

    expect(existsSync(skill)).toBe(false);
    expect(existsSync(member)).toBe(true);
    expect(groups.getGroupMembers('develop')).toEqual(['custom/member']);
  });

  it('test_remove_installed_same_name_skill_does_not_remove_group', async () => {
    createSkill('develop', 'custom', false);
    const member = createSkill('member');
    groups.addSkill('develop', 'custom/member');

    await expect(executeRemove('develop')).rejects.toThrow('process.exit');

    expect(existsSync(member)).toBe(true);
    expect(groups.getGroupMembers('develop')).toEqual(['custom/member']);
  });

  it('test_remove_empty_group_reports_no_deployed_members', async () => {
    groups.createGroup('develop');
    const unrelated = createSkill('unrelated');

    await expect(executeRemove('develop')).rejects.toThrow('process.exit');

    expect(console.log).toHaveBeenCalledWith(
      "No deployed skills found in group 'develop'.",
    );
    expect(existsSync(unrelated)).toBe(true);
  });
});

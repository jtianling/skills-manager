import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

vi.mock('../constants.js', async () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${process.pid}-${Date.now()}`);
  return {
    SKILLS_MANAGER_DIR: testDir,
    SKILL_SOURCES: ['official', 'community', 'custom'] as const,
    findOfficialProvider: () => null,
  };
});

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToUninstall: vi.fn().mockResolvedValue([]),
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import { SKILLS_MANAGER_DIR } from '../constants.js';
import { executeUninstall } from './uninstall.js';
import { SourcesService } from '../services/sources.js';
import { promptConfirm } from '../utils/prompts.js';
import { promptSkillsToUninstall } from '../utils/prompts.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';

function createSkillDir(path: string, name?: string): void {
  mkdirSync(path, { recursive: true });
  const skillName = name ?? path.split('/').pop() ?? 'test';
  writeFileSync(join(path, 'SKILL.md'), `---\nname: ${skillName}\ndescription: test skill\n---\nTest`);
}

describe('uninstall command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(promptConfirm).mockReset();
    vi.mocked(promptSkillsToUninstall).mockReset();
    vi.mocked(interactiveCheckbox).mockReset();
    vi.mocked(promptConfirm).mockResolvedValue(true);
    vi.mocked(promptSkillsToUninstall).mockResolvedValue([]);
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
  });

  describe('scoped interactive uninstall (owner/repo)', () => {
    it('shows checkbox with scoped skills for owner/repo', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-b');
      const otherSkill = join(SKILLS_MANAGER_DIR, 'community', 'other', 'repo', 'skill-c');
      createSkillDir(skill1);
      createSkillDir(skill2);
      createSkillDir(otherSkill);

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skill1]);

      await executeUninstall('myorg/myrepo', {});

      expect(promptSkillsToUninstall).toHaveBeenCalledTimes(1);
      const passedSkills = vi.mocked(promptSkillsToUninstall).mock.calls[0][0];
      const passedNames = passedSkills.map((s: { name: string }) => s.name).sort();
      expect(passedNames).toEqual(['skill-a', 'skill-b']);
    });

    it('removes only selected skills from checkbox', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-b');
      createSkillDir(skill1);
      createSkillDir(skill2);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skill1]);

      await executeUninstall('myorg/myrepo', {});

      expect(existsSync(skill1)).toBe(false);
      expect(existsSync(skill2)).toBe(true);

      logSpy.mockRestore();
    });

    it('does nothing when user selects nothing from checkbox', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'skill-b');
      createSkillDir(skill1);
      createSkillDir(skill2);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([]);

      await executeUninstall('myorg/myrepo', {});

      expect(existsSync(skill1)).toBe(true);
      expect(existsSync(skill2)).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('No skills selected.');

      logSpy.mockRestore();
    });

    it('prioritizes official over community for same owner/repo', async () => {
      const officialSkill1 = join(SKILLS_MANAGER_DIR, 'official', 'foo', 'bar', 'skill-x');
      const officialSkill2 = join(SKILLS_MANAGER_DIR, 'official', 'foo', 'bar', 'skill-z');
      const communitySkill = join(SKILLS_MANAGER_DIR, 'community', 'foo', 'bar', 'skill-y');
      createSkillDir(officialSkill1);
      createSkillDir(officialSkill2);
      createSkillDir(communitySkill);

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([officialSkill1]);

      await executeUninstall('foo/bar', {});

      const passedSkills = vi.mocked(promptSkillsToUninstall).mock.calls[0][0];
      const passedNames = passedSkills.map((s: { name: string }) => s.name).sort();
      expect(passedNames).toEqual(['skill-x', 'skill-z']);
      expect(existsSync(communitySkill)).toBe(true);
    });

    it('falls back to community when official does not exist', async () => {
      const communitySkill1 = join(SKILLS_MANAGER_DIR, 'community', 'foo', 'bar', 'skill-y');
      const communitySkill2 = join(SKILLS_MANAGER_DIR, 'community', 'foo', 'bar', 'skill-z');
      createSkillDir(communitySkill1);
      createSkillDir(communitySkill2);

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([communitySkill1]);

      await executeUninstall('foo/bar', {});

      expect(promptSkillsToUninstall).toHaveBeenCalledTimes(1);
      const passedSkills = vi.mocked(promptSkillsToUninstall).mock.calls[0][0];
      const passedNames = passedSkills.map((s: { name: string }) => s.name).sort();
      expect(passedNames).toEqual(['skill-y', 'skill-z']);
    });

    it('exits with error when owner/repo not found in official or community', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeUninstall('unknown/repo', {})).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(promptSkillsToUninstall).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('cleans empty parent dirs and sources after scoped uninstall', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'only-skill');
      createSkillDir(skill1);

      const sourcesService = new SourcesService();
      sourcesService.addSource('community/org/repo', {
        url: 'https://github.com/org/repo',
        type: 'community',
        repoName: 'repo',
      });

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skill1]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', {});

      expect(existsSync(join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo'))).toBe(false);
      expect(existsSync(join(SKILLS_MANAGER_DIR, 'community', 'org'))).toBe(false);
      expect(sourcesService.getSource('community/org/repo')).toBeUndefined();

      logSpy.mockRestore();
    });
  });

  describe('--all flag', () => {
    it('skips checkbox and goes straight to confirm', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-b');
      createSkillDir(skill1);
      createSkillDir(skill2);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', { all: true });

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).toHaveBeenCalled();
      expect(existsSync(skill1)).toBe(false);
      expect(existsSync(skill2)).toBe(false);

      logSpy.mockRestore();
    });

    it('--all with --force skips both checkbox and confirm', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-a');
      createSkillDir(skill1);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', { all: true, force: true });

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).not.toHaveBeenCalled();
      expect(existsSync(skill1)).toBe(false);

      logSpy.mockRestore();
    });

    it('--all removes all skills under official source', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'official', 'anthropics', 'skills', 'commit');
      const skill2 = join(SKILLS_MANAGER_DIR, 'official', 'anthropics', 'skills', 'code-review');
      createSkillDir(skill1);
      createSkillDir(skill2);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('anthropics/skills', { all: true, force: true });

      expect(existsSync(skill1)).toBe(false);
      expect(existsSync(skill2)).toBe(false);

      logSpy.mockRestore();
    });
  });

  describe('single skill skips checkbox', () => {
    it('skips checkbox when source has only one skill', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'only-skill');
      createSkillDir(skill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', {});

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).toHaveBeenCalled();
      expect(existsSync(skill)).toBe(false);

      logSpy.mockRestore();
    });

    it('single skill respects --force to skip confirm', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'only-skill');
      createSkillDir(skill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', { force: true });

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).not.toHaveBeenCalled();
      expect(existsSync(skill)).toBe(false);

      logSpy.mockRestore();
    });
  });

  describe('bare word goes to uninstallByName (no provider shorthand)', () => {
    it('treats former provider name as skill name lookup', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeUninstall('anthropic', { force: true })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(promptSkillsToUninstall).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('bare word finds and removes a skill by name', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'community', 'someorg', 'somerepo', 'my-tool');
      createSkillDir(skillDir);

      await executeUninstall('my-tool', { force: true });

      expect(existsSync(skillDir)).toBe(false);
    });
  });

  describe('skill name-level uninstall', () => {
    it('removes a single skill by name', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'community', 'someorg', 'somerepo', 'target-skill');
      createSkillDir(skillDir);
      const otherSkill = join(SKILLS_MANAGER_DIR, 'community', 'someorg', 'somerepo', 'other-skill');
      createSkillDir(otherSkill);

      await executeUninstall('target-skill', { force: true });

      expect(existsSync(skillDir)).toBe(false);
      expect(existsSync(otherSkill)).toBe(true);
    });

    it('removes custom skill from flat directory', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'custom', 'helper-skill');
      createSkillDir(skillDir);

      await executeUninstall('helper-skill', { force: true });

      expect(existsSync(skillDir)).toBe(false);
    });

    it('prompts selection when multiple same-name skills exist', async () => {
      const officialSkill = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'dupe-skill');
      const communitySkill = join(SKILLS_MANAGER_DIR, 'community', 'org1', 'repo1', 'dupe-skill');
      createSkillDir(officialSkill, 'dupe-skill');
      createSkillDir(communitySkill, 'dupe-skill');

      vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['official/anthropic/skills/dupe-skill']);

      await executeUninstall('dupe-skill', { force: true });

      expect(interactiveCheckbox).toHaveBeenCalled();
      expect(existsSync(officialSkill)).toBe(false);
      expect(existsSync(communitySkill)).toBe(true);
    });

    it('exits when skill name not found', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeUninstall('nonexistent', { force: true })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('user cancellation', () => {
    it('does not delete when user declines confirmation for scoped uninstall', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'keep-me');
      createSkillDir(skill);

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skill]);
      vi.mocked(promptConfirm).mockResolvedValueOnce(false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', {});

      expect(existsSync(skill)).toBe(true);

      logSpy.mockRestore();
    });
  });

  describe('interactive uninstall (no args)', () => {
    it('prints empty state when no installed skills exist', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall(undefined, {});

      expect(logSpy).toHaveBeenCalledWith('No installed skills found.');
      expect(promptSkillsToUninstall).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('prints no selection when user selects nothing', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'keep-me');
      createSkillDir(skillDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([]);

      await executeUninstall(undefined, {});

      expect(promptSkillsToUninstall).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('No skills selected.');
      expect(existsSync(skillDir)).toBe(true);

      logSpy.mockRestore();
    });

    it('removes selected skills after confirmation', async () => {
      const skillA = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'skill-a');
      const skillB = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-b');
      createSkillDir(skillA);
      createSkillDir(skillB);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skillA, skillB]);

      await executeUninstall(undefined, {});

      expect(existsSync(skillA)).toBe(false);
      expect(existsSync(skillB)).toBe(false);
      expect(logSpy).toHaveBeenCalledWith('Removed: skill-a');
      expect(logSpy).toHaveBeenCalledWith('Removed: skill-b');
      expect(logSpy).toHaveBeenCalledWith('Uninstalled 2 skills.');

      logSpy.mockRestore();
    });

    it('does not delete selected skills when confirmation is declined', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'custom', 'keep-me');
      createSkillDir(skillDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([skillDir]);
      vi.mocked(promptConfirm).mockResolvedValueOnce(false);

      await executeUninstall(undefined, {});

      expect(existsSync(skillDir)).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('Cancelled.');

      logSpy.mockRestore();
    });
  });

  describe('sources.json cleanup', () => {
    it('removes source record when all skills are deleted', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'only-skill');
      createSkillDir(skillDir);

      const sourcesService = new SourcesService();
      sourcesService.addSource('community/org/repo', {
        url: 'https://github.com/org/repo',
        type: 'community',
        repoName: 'repo',
      });

      await executeUninstall('only-skill', { force: true });

      expect(sourcesService.getSource('community/org/repo')).toBeUndefined();
    });

    it('keeps source record when other skills remain', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-b');
      createSkillDir(skill1);
      createSkillDir(skill2);

      const sourcesService = new SourcesService();
      sourcesService.addSource('community/org/repo', {
        url: 'https://github.com/org/repo',
        type: 'community',
        repoName: 'repo',
      });

      await executeUninstall('skill-a', { force: true });

      expect(sourcesService.getSource('community/org/repo')).toBeDefined();
    });
  });
});

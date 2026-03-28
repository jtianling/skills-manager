import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

vi.mock('../constants.js', async () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${process.pid}-${Date.now()}`);
  return {
    SKILLS_MANAGER_DIR: testDir,
    OFFICIAL_OWNERS: {
      'anthropic': 'anthropics',
      'vercel-labs': 'vercel-labs',
    },
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
    vi.clearAllMocks();
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

  describe('provider-level uninstall', () => {
    it('removes all skills under a provider', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'code-review');
      createSkillDir(skillDir);

      const sourcesService = new SourcesService();
      sourcesService.addSource('official/anthropic/skills', {
        url: 'https://github.com/anthropics/skills',
        type: 'official',
        repoName: 'skills',
      });

      await executeUninstall('anthropic', { force: true });

      expect(existsSync(join(SKILLS_MANAGER_DIR, 'official', 'anthropic'))).toBe(false);
      expect(sourcesService.getSource('official/anthropic/skills')).toBeUndefined();
    });

    it('exits when provider has no installed skills', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeUninstall('anthropic', { force: true })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('community source-level uninstall', () => {
    it('removes all skills under owner/repo', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo', 'my-skill');
      createSkillDir(skillDir);

      const sourcesService = new SourcesService();
      sourcesService.addSource('community/myorg/myrepo', {
        url: 'https://github.com/myorg/myrepo',
        type: 'community',
        repoName: 'myrepo',
      });

      await executeUninstall('myorg/myrepo', { force: true });

      expect(existsSync(join(SKILLS_MANAGER_DIR, 'community', 'myorg', 'myrepo'))).toBe(false);
      expect(existsSync(join(SKILLS_MANAGER_DIR, 'community', 'myorg'))).toBe(false);
      expect(sourcesService.getSource('community/myorg/myrepo')).toBeUndefined();
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
    it('does not delete when user declines confirmation', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'keep-me');
      createSkillDir(skillDir);

      vi.mocked(promptConfirm).mockResolvedValueOnce(false);

      await executeUninstall('anthropic', {});

      expect(existsSync(skillDir)).toBe(true);
    });
  });

  describe('interactive uninstall', () => {
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

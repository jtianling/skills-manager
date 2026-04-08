import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

vi.mock('../constants.js', async () => {
  const actual = await vi.importActual<typeof import('../constants.js')>('../constants.js');
  const testDir = join(tmpdir(), `skillsmgr-test-${process.pid}-${Date.now()}`);
  return {
    ...actual,
    SKILLS_MANAGER_DIR: testDir,
    SKILL_SOURCES: ['official', 'community', 'custom', 'registry'] as const,
  };
});

vi.mock('../utils/prompts.js', () => ({
  loadGroupsData: vi.fn().mockReturnValue({}),
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToUninstall: vi.fn().mockResolvedValue([]),
  promptSelect: vi.fn().mockResolvedValue(''),
}));

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import { SKILLS_MANAGER_DIR } from '../constants.js';
import { executeUninstall } from './uninstall.js';
import { SourcesService } from '../services/sources.js';
import { loadGroupsData, promptConfirm, promptSelect } from '../utils/prompts.js';
import { promptSkillsToUninstall } from '../utils/prompts.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';

function inferGitOwner(providerOrOwner: string): string {
  if (providerOrOwner === 'anthropic') return 'anthropics';
  if (providerOrOwner === 'vercel-labs') return 'vercel';
  return providerOrOwner;
}

function createSkillDir(path: string, name?: string): void {
  mkdirSync(path, { recursive: true });
  const skillName = name ?? path.split('/').pop() ?? 'test';
  writeFileSync(join(path, 'SKILL.md'), `---\nname: ${skillName}\ndescription: test skill\n---\nTest`);

  const rel = path.replace(`${SKILLS_MANAGER_DIR}/`, '').split('/');
  const sourcesService = new SourcesService();

  if (rel[0] === 'community' && rel.length >= 4) {
    sourcesService.addSource(`community/${rel[1]}/${rel[2]}`, {
      url: `https://github.com/${rel[1]}/${rel[2]}`,
      type: 'community',
      repoName: rel[2],
      installMethod: 'git',
    });
    return;
  }

  if (rel[0] === 'official' && rel.length >= 4) {
    const owner = inferGitOwner(rel[1]);
    sourcesService.addSource(`official/${rel[1]}/${rel[2]}`, {
      url: `https://github.com/${owner}/${rel[2]}`,
      type: 'official',
      repoName: rel[2],
      installMethod: 'git',
    });
    return;
  }

  if (rel[0] === 'custom' && rel.length >= 2) {
    const sourceKey = rel.length >= 3
      ? `custom/${rel[1]}/${rel[2]}`
      : `custom/${rel[1]}`;
    const repoName = rel.length >= 3 ? rel[2] : rel[1];
    sourcesService.addSource(sourceKey, {
      url: path,
      type: 'custom',
      repoName,
      installMethod: 'local-copy',
    });
  }
}

describe('uninstall command', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(promptConfirm).mockReset();
    vi.mocked(promptSkillsToUninstall).mockReset();
    vi.mocked(interactiveCheckbox).mockReset();
    vi.mocked(promptSelect).mockReset();
    vi.mocked(promptConfirm).mockResolvedValue(true);
    vi.mocked(promptSkillsToUninstall).mockResolvedValue([]);
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
    vi.mocked(promptSelect).mockResolvedValue('');
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

    it('prioritizes translated official source over matching community repo', async () => {
      const officialSkill1 = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'skill-x');
      const officialSkill2 = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'skill-z');
      const communitySkill = join(SKILLS_MANAGER_DIR, 'community', 'anthropics', 'skills', 'skill-y');
      createSkillDir(officialSkill1);
      createSkillDir(officialSkill2);
      createSkillDir(communitySkill);

      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([officialSkill1]);

      await executeUninstall('anthropics/skills', {});

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
      const skill1 = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'commit');
      const skill2 = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'code-review');
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

    it('removes a single skill via owner/repo:skill', async () => {
      const targetSkill = join(SKILLS_MANAGER_DIR, 'community', 'obra', 'superpowers', 'brainstorming');
      const otherSkill = join(SKILLS_MANAGER_DIR, 'community', 'obra', 'superpowers', 'research');
      createSkillDir(targetSkill);
      createSkillDir(otherSkill);

      await executeUninstall('obra/superpowers:brainstorming', { force: true });

      expect(existsSync(targetSkill)).toBe(false);
      expect(existsSync(otherSkill)).toBe(true);
    });

    it('prompts selection when multiple same-name skills exist', async () => {
      const officialSkill = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'dupe-skill');
      const communitySkill = join(SKILLS_MANAGER_DIR, 'community', 'org1', 'repo1', 'dupe-skill');
      createSkillDir(officialSkill, 'dupe-skill');
      createSkillDir(communitySkill, 'dupe-skill');

      vi.mocked(promptSelect).mockResolvedValueOnce('official/anthropic/skills/dupe-skill');

      await executeUninstall('dupe-skill', { force: true });

      expect(promptSelect).toHaveBeenCalled();
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

    it('passes virtual groups data into uninstall prompt', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'custom', 'keep-me');
      createSkillDir(skillDir);
      vi.mocked(loadGroupsData).mockReturnValue({
        dev: ['custom/keep-me'],
      });
      vi.mocked(promptSkillsToUninstall).mockResolvedValueOnce([]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall(undefined, {});

      expect(promptSkillsToUninstall).toHaveBeenCalledWith(
        expect.any(Array),
        { dev: ['custom/keep-me'] },
      );

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

  describe('-y flag', () => {
    it('maps -y to --all + --force, skipping all prompts', async () => {
      const skill1 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-a');
      const skill2 = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-b');
      createSkillDir(skill1);
      createSkillDir(skill2);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', { yes: true });

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).not.toHaveBeenCalled();
      expect(existsSync(skill1)).toBe(false);
      expect(existsSync(skill2)).toBe(false);

      logSpy.mockRestore();
    });

    it('-y with explicit --all and -f does not conflict', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'org', 'repo', 'skill-a');
      createSkillDir(skill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('org/repo', { yes: true, all: true, force: true });

      expect(promptSkillsToUninstall).not.toHaveBeenCalled();
      expect(promptConfirm).not.toHaveBeenCalled();
      expect(existsSync(skill)).toBe(false);

      logSpy.mockRestore();
    });

    it('-y with skill name skips confirmation', async () => {
      const skillDir = join(SKILLS_MANAGER_DIR, 'community', 'someorg', 'somerepo', 'my-tool');
      createSkillDir(skillDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('my-tool', { yes: true });

      expect(promptConfirm).not.toHaveBeenCalled();
      expect(existsSync(skillDir)).toBe(false);

      logSpy.mockRestore();
    });

    it('-y does not affect other source skills (no side effects)', async () => {
      const targetSkill = join(SKILLS_MANAGER_DIR, 'official', 'anthropic', 'skills', 'commit');
      const otherSkill = join(SKILLS_MANAGER_DIR, 'custom', 'my-custom');
      createSkillDir(targetSkill);
      createSkillDir(otherSkill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('anthropics/skills', { yes: true });

      expect(existsSync(targetSkill)).toBe(false);
      expect(existsSync(otherSkill)).toBe(true);

      logSpy.mockRestore();
    });
  });

  describe('URL input support', () => {
    it('uninstalls via HTTPS URL with .git suffix', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'obra', 'superpowers', 'my-skill');
      createSkillDir(skill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('https://github.com/obra/superpowers.git', { force: true });

      expect(existsSync(skill)).toBe(false);
      logSpy.mockRestore();
    });

    it('uninstalls via GitLab HTTPS URL', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'foo', 'bar', 'my-skill');
      createSkillDir(skill);
      const sourcesService = new SourcesService();
      sourcesService.addSource('community/foo/bar', {
        url: 'https://gitlab.com/foo/bar',
        type: 'community',
        repoName: 'bar',
        installMethod: 'git',
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('https://gitlab.com/foo/bar', { force: true });

      expect(existsSync(skill)).toBe(false);
      logSpy.mockRestore();
    });

    it('uninstalls via SSH URL', async () => {
      const skill = join(SKILLS_MANAGER_DIR, 'community', 'obra', 'superpowers', 'my-skill');
      createSkillDir(skill);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall('git@github.com:obra/superpowers.git', { force: true });

      expect(existsSync(skill)).toBe(false);
      logSpy.mockRestore();
    });

    it('falls back to skill name lookup for non-extractable URL', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeUninstall('https://example.com/', {})).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('uninstalls local batch bundle by directory path', async () => {
      const batchDir = join(tmpdir(), `skillsmgr-uninstall-batch-${Date.now()}`, 'spec-tdd');
      mkdirSync(join(batchDir, 'skill-a'), { recursive: true });
      mkdirSync(join(batchDir, 'skill-b'), { recursive: true });
      writeFileSync(join(batchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');
      writeFileSync(join(batchDir, 'skill-b', 'SKILL.md'), '---\nname: skill-b\n---\n');

      createSkillDir(join(SKILLS_MANAGER_DIR, 'custom', 'spec-tdd', 'skill-a'));
      createSkillDir(join(SKILLS_MANAGER_DIR, 'custom', 'spec-tdd', 'skill-b'));

      const sourcesService = new SourcesService();
      sourcesService.addSource('custom/spec-tdd/skill-a', {
        url: batchDir,
        type: 'custom',
        repoName: 'skill-a',
        installMethod: 'local-copy',
      });
      sourcesService.addSource('custom/spec-tdd/skill-b', {
        url: batchDir,
        type: 'custom',
        repoName: 'skill-b',
        installMethod: 'local-copy',
      });
      sourcesService.addBundle(`local-batch:${batchDir}`, {
        type: 'local-batch',
        url: batchDir,
        selectionMode: 'all',
        members: ['custom/spec-tdd/skill-a', 'custom/spec-tdd/skill-b'],
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeUninstall(batchDir, { force: true });

      expect(existsSync(join(SKILLS_MANAGER_DIR, 'custom', 'spec-tdd', 'skill-a'))).toBe(false);
      expect(existsSync(join(SKILLS_MANAGER_DIR, 'custom', 'spec-tdd', 'skill-b'))).toBe(false);
      expect(sourcesService.getSource('custom/spec-tdd/skill-a')).toBeUndefined();
      expect(sourcesService.getSource('custom/spec-tdd/skill-b')).toBeUndefined();
      expect(sourcesService.getBundle(`local-batch:${batchDir}`)).toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        `Uninstalled 2 skills from bundle local-batch:${batchDir}`
      );

      rmSync(join(batchDir, '..'), { recursive: true, force: true });
      logSpy.mockRestore();
    });

    it('reports not found for untracked batch directory path', async () => {
      const batchDir = join(tmpdir(), `skillsmgr-uninstall-batch-missing-${Date.now()}`, 'spec-tdd');
      mkdirSync(join(batchDir, 'skill-a'), { recursive: true });
      writeFileSync(join(batchDir, 'skill-a', 'SKILL.md'), '---\nname: skill-a\n---\n');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(executeUninstall(batchDir, {})).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        `Error: No installed skill found from path: ${batchDir}`
      );

      rmSync(join(batchDir, '..'), { recursive: true, force: true });
      errorSpy.mockRestore();
      mockExit.mockRestore();
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

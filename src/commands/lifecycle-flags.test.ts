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
import { executeRemove } from './remove.js';
import { selectSkills } from './install-utils.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';
import * as constants from '../constants.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import type { InstallableSkill } from './install-utils.js';

describe('lifecycle with -s/--skill and -a/--agent flags', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-lifecycle-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-lifecycle-proj-${id}`);

    mkdirSync(join(testManagerDir, 'official'), { recursive: true });
    mkdirSync(join(testManagerDir, 'community'), { recursive: true });
    mkdirSync(join(testManagerDir, 'custom'), { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

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
      `---\nname: ${name}\ndescription: ${description}\n---\n`,
    );
  }

  function deploySkillAsLink(name: string): void {
    const sourcePath = findSkillPath(name);
    const targetPath = join(testProjectDir, '.agents', 'skills', name);
    symlinkSync(sourcePath, targetPath);
  }

  function findSkillPath(name: string): string {
    for (const category of ['official', 'community', 'custom']) {
      const dirs = ['anthropic/skills', 'org/repo'];
      for (const dir of dirs) {
        const path = join(testManagerDir, category, dir, name);
        if (existsSync(path)) return path;
      }
      const directPath = join(testManagerDir, category, name);
      if (existsSync(directPath)) return directPath;
    }
    throw new Error(`Skill ${name} not found in test dirs`);
  }

  function isDeployed(name: string): boolean {
    return existsSync(join(testProjectDir, '.agents', 'skills', name));
  }

  // ── selectSkills (install phase) ──

  describe('install: selectSkills with --skill', () => {
    const skills: InstallableSkill[] = [
      { name: 'code-review', description: 'CR', path: '/a' },
      { name: 'tdd', description: 'TDD', path: '/b' },
      { name: 'debugging', description: 'Debug', path: '/c' },
    ];

    it('filters to specific skills, skips prompt', async () => {
      const result = await selectSkills(skills, {
        skill: ['code-review', 'debugging'],
      });
      expect(result.map((s) => s.name)).toEqual(['code-review', 'debugging']);
      expect(interactiveCheckbox).not.toHaveBeenCalled();
    });

    it('rejects nonexistent skill name', async () => {
      await selectSkills(skills, { skill: ['nonexistent'] });
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith("Skill 'nonexistent' not found.");
    });
  });

  // ── add: project-level with -s and -a ──

  describe('add: project-level with -s and -a', () => {
    it('add owner/repo -s skill1 -s skill2 -a claude-code: no interaction', async () => {
      createSkill('community/org/repo', 'skill-alpha', 'Alpha');
      createSkill('community/org/repo', 'skill-beta', 'Beta');
      createSkill('community/org/repo', 'skill-gamma', 'Gamma');

      await executeAdd('org/repo', {
        skill: ['skill-alpha', 'skill-beta'],
        agent: ['claude-code'],
      });

      expect(isDeployed('skill-alpha')).toBe(true);
      expect(isDeployed('skill-beta')).toBe(true);
      expect(isDeployed('skill-gamma')).toBe(false);
      expect(interactiveCheckbox).not.toHaveBeenCalled();
    });

    it('add owner/repo -s only: skill selected, agent prompted', async () => {
      createSkill('community/org/repo', 'skill-alpha', 'Alpha');
      createSkill('community/org/repo', 'skill-beta', 'Beta');

      vi.mocked(interactiveCheckbox).mockResolvedValueOnce([
        'agents-skills-standard',
      ]);

      await executeAdd('org/repo', { skill: ['skill-alpha'] });

      expect(isDeployed('skill-alpha')).toBe(true);
      expect(isDeployed('skill-beta')).toBe(false);
      // interactiveCheckbox called once for agent selection
      expect(interactiveCheckbox).toHaveBeenCalledTimes(1);
    });

    it('add owner/repo -a only: agent selected, skill prompted', async () => {
      createSkill('community/org/repo', 'skill-alpha', 'Alpha');

      vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-alpha']);

      await executeAdd('org/repo', { agent: ['claude-code'] });

      expect(isDeployed('skill-alpha')).toBe(true);
      // interactiveCheckbox called once for skill selection
      expect(interactiveCheckbox).toHaveBeenCalledTimes(1);
    });

    it('add skill-name -a claude-code: direct deploy', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');

      await executeAdd('code-review', { agent: ['claude-code'] });

      expect(isDeployed('code-review')).toBe(true);
      expect(interactiveCheckbox).not.toHaveBeenCalled();
    });

    it('add -s nonexistent skill exits with error', async () => {
      createSkill('community/org/repo', 'real-skill', 'Real');

      await executeAdd('org/repo', {
        skill: ['nonexistent'],
        agent: ['claude-code'],
      });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        "Skill 'nonexistent' not found.",
      );
    });

    it('add -a invalid-agent exits with error', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');

      await executeAdd('code-review', { agent: ['bad-agent'] });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Unknown agent: 'bad-agent'"),
      );
    });
  });

  // ── add: global with -g -s -a ──

  describe('add: global with -g -s -a', () => {
    it('add -g skill-name -a claude-code: global deploy', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      await executeAdd('code-review', { global: true, agent: [agent] });

      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✓ code-review'),
      );

      // cleanup
      await executeRemove('code-review', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
    });

    it('add -g owner/repo -s skill1 -a claude-code: global + skill filter', async () => {
      createSkill('community/org/repo', 'skill-alpha', 'Alpha');
      createSkill('community/org/repo', 'skill-beta', 'Beta');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      await executeAdd('org/repo', {
        global: true,
        skill: ['skill-alpha'],
        agent: [agent],
      });

      expect(existsSync(join(globalDir, 'skill-alpha'))).toBe(true);
      expect(existsSync(join(globalDir, 'skill-beta'))).toBe(false);
      expect(interactiveCheckbox).not.toHaveBeenCalled();

      // cleanup
      await executeRemove('skill-alpha', { global: true, agent: [agent] });
    });
  });

  // ── remove: project-level with -s ──

  describe('remove: project-level with -s', () => {
    it('remove -s skill1 -s skill2: batch remove', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');
      deploySkillAsLink('code-review');
      deploySkillAsLink('tdd');

      expect(isDeployed('code-review')).toBe(true);
      expect(isDeployed('tdd')).toBe(true);

      await executeRemove(undefined, { skill: ['code-review', 'tdd'] });

      expect(isDeployed('code-review')).toBe(false);
      expect(isDeployed('tdd')).toBe(false);
    });

    it('remove skillname -s other: merge positional + flag', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');
      deploySkillAsLink('code-review');
      deploySkillAsLink('tdd');

      await executeRemove('code-review', { skill: ['tdd'] });

      expect(isDeployed('code-review')).toBe(false);
      expect(isDeployed('tdd')).toBe(false);
    });
  });

  // ── remove: global with -g -a ──

  describe('remove: global with -g -a', () => {
    it('remove -g -s skill1 -a claude-code: global batch remove', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      // deploy globally
      await executeAdd('code-review', { global: true, agent: [agent] });
      await executeAdd('tdd', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);
      expect(existsSync(join(globalDir, 'tdd'))).toBe(true);

      // remove globally with -s
      await executeRemove(undefined, {
        global: true,
        skill: ['code-review', 'tdd'],
        agent: [agent],
      });

      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
      expect(existsSync(join(globalDir, 'tdd'))).toBe(false);
    });
  });

  // ── full lifecycle: install → add → remove → uninstall ──

  describe('full lifecycle with flags', () => {
    it('install --skill → add -s -a → remove -s → verify', async () => {
      // Simulate "install" by creating skills in central repo
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');
      createSkill('official/anthropic/skills', 'debugging', 'Debug');

      // selectSkills with --skill filter (install phase)
      const allSkills: InstallableSkill[] = [
        { name: 'code-review', description: 'CR', path: join(testManagerDir, 'official/anthropic/skills/code-review') },
        { name: 'tdd', description: 'TDD', path: join(testManagerDir, 'official/anthropic/skills/tdd') },
        { name: 'debugging', description: 'Debug', path: join(testManagerDir, 'official/anthropic/skills/debugging') },
      ];

      const selected = await selectSkills(allSkills, {
        skill: ['code-review', 'tdd'],
      });
      expect(selected.length).toBe(2);
      expect(selected.map((s) => s.name)).toEqual(['code-review', 'tdd']);

      // Add to project with -s -a (no interaction)
      await executeAdd('anthropics/skills', {
        skill: ['code-review', 'tdd'],
        agent: ['claude-code'],
      });

      expect(isDeployed('code-review')).toBe(true);
      expect(isDeployed('tdd')).toBe(true);
      expect(isDeployed('debugging')).toBe(false);
      expect(interactiveCheckbox).not.toHaveBeenCalled();

      // Remove one skill
      await executeRemove(undefined, { skill: ['tdd'] });
      expect(isDeployed('code-review')).toBe(true);
      expect(isDeployed('tdd')).toBe(false);

      // Remove remaining skill
      await executeRemove('code-review', {});
      expect(isDeployed('code-review')).toBe(false);
    });

    it('global lifecycle: add -g -s -a → remove -g -s -a', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      createSkill('official/anthropic/skills', 'tdd', 'TDD');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      // Add globally with skill filter
      await executeAdd('anthropics/skills', {
        global: true,
        skill: ['code-review'],
        agent: [agent],
      });

      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);
      expect(existsSync(join(globalDir, 'tdd'))).toBe(false);

      // Add second skill globally
      await executeAdd('tdd', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'tdd'))).toBe(true);

      // Remove one globally
      await executeRemove(undefined, {
        global: true,
        skill: ['code-review'],
        agent: [agent],
      });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
      expect(existsSync(join(globalDir, 'tdd'))).toBe(true);

      // Remove remaining
      await executeRemove('tdd', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'tdd'))).toBe(false);
    });

    it('mixed: project + global in parallel', async () => {
      createSkill('official/anthropic/skills', 'code-review', 'CR');
      const agent = 'claude-code';
      const globalDir = TOOL_CONFIGS[agent].globalSkillsDir;

      // Deploy to project
      await executeAdd('code-review', { agent: [agent] });
      expect(isDeployed('code-review')).toBe(true);

      // Deploy same skill globally
      await executeAdd('code-review', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);

      // Remove from project only
      await executeRemove('code-review', {});
      expect(isDeployed('code-review')).toBe(false);
      expect(existsSync(join(globalDir, 'code-review'))).toBe(true);

      // Remove from global
      await executeRemove('code-review', { global: true, agent: [agent] });
      expect(existsSync(join(globalDir, 'code-review'))).toBe(false);
    });
  });
});

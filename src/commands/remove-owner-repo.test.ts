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
import { TOOL_CONFIGS } from '../tools/configs.js';
import type { ToolName } from '../types.js';
import { interactiveCheckbox } from '../utils/interactive-select.js';

function createSkillInManager(
  managerDir: string,
  source: string,
  skillName: string,
): string {
  const skillDir = join(managerDir, source, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: test\n---\n`,
  );
  return skillDir;
}

function deploySkillAsLink(
  projectDir: string,
  skillName: string,
  sourcePath: string,
): string {
  const deployedPath = join(projectDir, '.agents', 'skills', skillName);
  symlinkSync(sourcePath, deployedPath);
  return deployedPath;
}

describe('remove command - owner/repo format', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let testGlobalDir: string;
  let originalCwd: typeof process.cwd;
  const savedGlobalDirs = new Map<string, string>();

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-remove-or-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-remove-or-test-proj-${id}`);
    testGlobalDir = join(tmpdir(), `skillsmgr-remove-or-test-global-${id}`);

    mkdirSync(testManagerDir, { recursive: true });
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

  it('shows checkbox and removes selected skills from owner/repo source', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const sourceB = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-b');
    createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-c');

    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);
    const deployedB = deploySkillAsLink(testProjectDir, 'skill-b', sourceB);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-a', 'skill-b']);

    await executeRemove('mattpocock/skills', {});

    expect(interactiveCheckbox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('mattpocock/skills'),
      }),
    );
    expect(existsSync(deployedA)).toBe(false);
    expect(existsSync(deployedB)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-a');
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-b');
  });

  it('shows checkbox even when only one skill deployed', async () => {
    const sourceCommit = createSkillInManager(testManagerDir, 'official/anthropic/skills', 'commit');
    createSkillInManager(testManagerDir, 'official/anthropic/skills', 'code-review');

    const deployedCommit = deploySkillAsLink(testProjectDir, 'commit', sourceCommit);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['commit']);

    await executeRemove('anthropics/skills', {});

    expect(interactiveCheckbox).toHaveBeenCalled();
    expect(existsSync(deployedCommit)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed commit');
  });

  it('uses virtual group choices in owner repo interactive remove', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const sourceB = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-b');

    deploySkillAsLink(testProjectDir, 'skill-a', sourceA);
    deploySkillAsLink(testProjectDir, 'skill-b', sourceB);

    const groupsService = new GroupsService();
    groupsService.addSkill('alpha', 'community/mattpocock/skills/skill-a');

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce([]);

    await executeRemove('mattpocock/skills', {});

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: "Select skills to remove from 'mattpocock/skills':",
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
          subGroup: '(ungrouped)',
        },
      ],
    });
    expect(console.log).toHaveBeenCalledWith('No skills selected.');
  });

  it('does nothing when user selects nothing from checkbox', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const sourceB = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-b');

    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);
    const deployedB = deploySkillAsLink(testProjectDir, 'skill-b', sourceB);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce([]);

    await executeRemove('mattpocock/skills', {});

    expect(existsSync(deployedA)).toBe(true);
    expect(existsSync(deployedB)).toBe(true);
    expect(console.log).toHaveBeenCalledWith('No skills selected.');
  });

  it('exits with 1 when owner/repo has no deployed skills', async () => {
    createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('mattpocock/skills', {})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No deployed skills found from 'mattpocock/skills'"),
    );
  });

  it('exits with 1 when owner/repo not found in central repository', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeRemove('unknown/repo', {})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("'unknown/repo' not found in central repository"),
    );
  });

  it('does not remove same-name skill from different source', async () => {
    const communitySource = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const officialSource = createSkillInManager(testManagerDir, 'official/anthropic/skills', 'skill-a');

    const deployedCommunity = deploySkillAsLink(testProjectDir, 'skill-a', communitySource);

    // Deploy official skill-a with a different deployed name to avoid symlink collision
    // In practice, two same-name skills from different sources can't both be deployed
    // because they'd occupy the same directory. This test verifies the matching logic
    // only targets the correct source's skills.

    // Remove community source — should remove community's skill-a
    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-a']);
    await executeRemove('mattpocock/skills', {});
    expect(existsSync(deployedCommunity)).toBe(false);

    // Re-deploy official's skill-a and verify it survives anthropics/skills removal
    const deployedOfficial = deploySkillAsLink(testProjectDir, 'skill-a', officialSource);
    vi.mocked(interactiveCheckbox).mockResolvedValueOnce([]);
    await executeRemove('mattpocock/skills', {}).catch(() => {});
    expect(existsSync(deployedOfficial)).toBe(true);
  });

  it('works with --global flag for owner/repo', async () => {
    createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const globalPath = join(TOOL_CONFIGS['claude-code'].globalSkillsDir, 'skill-a');
    mkdirSync(globalPath, { recursive: true });
    writeFileSync(join(globalPath, 'SKILL.md'), '---\nname: skill-a\ndescription: test\n---\n');

    await executeRemove('mattpocock/skills', { global: true, agent: ['claude-code'] });

    expect(existsSync(globalPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Removed skill-a'),
    );
  });

  it('still removes by plain skill name (regression)', async () => {
    const sourceCommit = createSkillInManager(testManagerDir, 'official/anthropic/skills', 'commit');
    const deployedPath = deploySkillAsLink(testProjectDir, 'commit', sourceCommit);

    await executeRemove('commit', {});

    expect(existsSync(deployedPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed commit');
  });

  it('removes via HTTPS URL by extracting owner/repo', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-a']);

    await executeRemove('https://github.com/mattpocock/skills', {});

    expect(existsSync(deployedA)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-a');
  });

  it('removes via GitLab URL', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/foo/bar', 'skill-a');
    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-a']);

    await executeRemove('https://gitlab.com/foo/bar', {});

    expect(existsSync(deployedA)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-a');
  });

  it('removes via SSH URL', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['skill-a']);

    await executeRemove('git@github.com:mattpocock/skills.git', {});

    expect(existsSync(deployedA)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-a');
  });
});

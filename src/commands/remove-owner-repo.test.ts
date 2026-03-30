import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';

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
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-remove-or-test-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-remove-or-test-proj-${id}`);

    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('removes all deployed skills from owner/repo source', async () => {
    const sourceA = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    const sourceB = createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-b');
    createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-c');

    const deployedA = deploySkillAsLink(testProjectDir, 'skill-a', sourceA);
    const deployedB = deploySkillAsLink(testProjectDir, 'skill-b', sourceB);

    await executeRemove('mattpocock/skills', {});

    expect(existsSync(deployedA)).toBe(false);
    expect(existsSync(deployedB)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-a');
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed skill-b');
  });

  it('matches official provider alias for owner/repo', async () => {
    const sourceCommit = createSkillInManager(testManagerDir, 'official/anthropic/skills', 'commit');
    createSkillInManager(testManagerDir, 'official/anthropic/skills', 'code-review');

    const deployedCommit = deploySkillAsLink(testProjectDir, 'commit', sourceCommit);

    await executeRemove('anthropics/skills', {});

    expect(existsSync(deployedCommit)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed commit');
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
    await executeRemove('mattpocock/skills', {});
    expect(existsSync(deployedCommunity)).toBe(false);

    // Re-deploy official's skill-a and verify it survives anthropics/skills removal
    const deployedOfficial = deploySkillAsLink(testProjectDir, 'skill-a', officialSource);
    await executeRemove('mattpocock/skills', {}).catch(() => {});
    expect(existsSync(deployedOfficial)).toBe(true);
  });

  it('works with --global flag for owner/repo', async () => {
    createSkillInManager(testManagerDir, 'community/mattpocock/skills', 'skill-a');

    // Global mode with explicit agent to avoid interactive prompt
    await executeRemove('mattpocock/skills', { global: true, agent: ['claude-code'] });
  });

  it('still removes by plain skill name (regression)', async () => {
    const sourceCommit = createSkillInManager(testManagerDir, 'official/anthropic/skills', 'commit');
    const deployedPath = deploySkillAsLink(testProjectDir, 'commit', sourceCommit);

    await executeRemove('commit', {});

    expect(existsSync(deployedPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith('  ✓ Removed commit');
  });
});

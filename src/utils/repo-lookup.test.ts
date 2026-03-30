import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { SkillsService } from '../services/skills.js';
import * as constants from '../constants.js';
import { detectArgFormat, findRepoInCentralRepository } from './repo-lookup.js';

function createSkill(
  managerDir: string,
  source: string,
  skillName: string,
): void {
  const skillDir = join(managerDir, source, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${skillName}\ndescription: test\n---\n`,
  );
}

describe('repo lookup utils', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-repo-lookup-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects skill-name, owner/repo and install-source inputs', () => {
    expect(detectArgFormat('commit')).toBe('skill-name');
    expect(detectArgFormat('mattpocock/skills')).toBe('owner-repo');
    expect(detectArgFormat('https://github.com/mattpocock/skills')).toBe('install-source');
  });

  it('finds community repo skills from the central repository', () => {
    createSkill(testManagerDir, 'community/mattpocock/skills', 'skill-a');
    createSkill(testManagerDir, 'community/mattpocock/skills', 'skill-b');

    const skillsService = new SkillsService(testManagerDir);
    const repoSkills = findRepoInCentralRepository('mattpocock/skills', skillsService);

    expect(repoSkills?.map((skill) => skill.name).sort()).toEqual(['skill-a', 'skill-b']);
    expect(repoSkills?.every((skill) => skill.source === 'community/mattpocock/skills')).toBe(true);
  });

  it('maps official owner alias to provider source', () => {
    createSkill(testManagerDir, 'official/anthropic/skills', 'commit');

    const skillsService = new SkillsService(testManagerDir);
    const repoSkills = findRepoInCentralRepository('anthropics/skills', skillsService);

    expect(repoSkills?.map((skill) => skill.name)).toEqual(['commit']);
    expect(repoSkills?.[0]?.source).toBe('official/anthropic/skills');
  });

  it('returns null when repo is missing in the central repository', () => {
    const skillsService = new SkillsService(testManagerDir);
    expect(findRepoInCentralRepository('unknown/repo', skillsService)).toBeNull();
  });
});

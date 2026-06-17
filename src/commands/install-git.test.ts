import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
const gitCloneState = vi.hoisted(() => ({ repoPath: '' }));

vi.mock('../services/repo-clone.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/repo-clone.js')>();
  const { cpSync, mkdtempSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');

  return {
    ...actual,
    async cloneRepoToTemp() {
      const tempDir = mkdtempSync(join(tmpdir(), 'skillsmgr-git-test-'));
      const repoPath = join(tempDir, 'repo');
      cpSync(gitCloneState.repoPath, repoPath, { recursive: true });
      return {
        repoPath,
        commitSha: 'b'.repeat(40),
        cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
      };
    },
  };
});

import * as constants from '../constants.js';
import { collectGitCloneSkills } from './install-git.js';
import { executeInstall } from './install.js';

function writeSkillMd(dir: string, name: string, description: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}`,
  );
}

describe('collectGitCloneSkills', () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = join(tmpdir(), `skillsmgr-git-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(repoPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  it('discovers skills from marketplace.json plugins', () => {
    mkdirSync(join(repoPath, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(repoPath, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        metadata: { pluginRoot: './.github/plugins' },
        plugins: [
          { name: 'sdk-python', source: './sdk-python', skills: 'skills/' },
          { name: 'sdk-ts', source: './sdk-ts', skills: 'skills/' },
        ],
      }),
    );

    writeSkillMd(join(repoPath, '.github', 'plugins', 'sdk-python', 'skills', 'azure-py'), 'azure-py', 'Azure Python');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'sdk-python', 'skills', 'storage-py'), 'storage-py', 'Storage Python');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'sdk-ts', 'skills', 'azure-ts'), 'azure-ts', 'Azure TypeScript');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['azure-py', 'azure-ts', 'storage-py']);
  });

  it('merges manifest skills with top-level skills', () => {
    mkdirSync(join(repoPath, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(repoPath, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        metadata: { pluginRoot: './.github/plugins' },
        plugins: [
          { name: 'my-plugin', source: './my-plugin', skills: 'skills/' },
        ],
      }),
    );

    writeSkillMd(join(repoPath, '.github', 'plugins', 'my-plugin', 'skills', 'plugin-skill'), 'plugin-skill', 'From plugin');
    writeSkillMd(join(repoPath, 'skills', 'top-skill'), 'top-skill', 'Top level skill');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['plugin-skill', 'top-skill']);
  });

  it('deduplicates skills by name across sources', () => {
    mkdirSync(join(repoPath, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(repoPath, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        plugins: [{ name: 'root', source: './', skills: './skills/' }],
      }),
    );

    writeSkillMd(join(repoPath, 'skills', 'my-skill'), 'my-skill', 'Skill');

    const skills = collectGitCloneSkills(repoPath);
    expect(skills.filter((s) => s.name === 'my-skill')).toHaveLength(1);
  });

  it('falls back to recursive scan when no manifest exists', () => {
    writeSkillMd(join(repoPath, 'skills', 'plain-skill'), 'plain-skill', 'Plain');

    const skills = collectGitCloneSkills(repoPath);
    expect(skills.map((s) => s.name)).toEqual(['plain-skill']);
  });

  it('prefers child skills over root skill in flat multi-skill repos', () => {
    writeSkillMd(repoPath, 'gstack', 'Repo root');
    writeSkillMd(join(repoPath, 'ship'), 'ship', 'Ship skill');
    writeSkillMd(join(repoPath, 'qa'), 'qa', 'QA skill');
    writeSkillMd(join(repoPath, 'browse'), 'browse', 'Browse skill');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['browse', 'qa', 'ship']);
  });

  it('returns root skill when no child skills exist', () => {
    writeSkillMd(repoPath, 'solo-skill', 'Root only');

    const skills = collectGitCloneSkills(repoPath);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe('solo-skill');
    expect(skills[0]?.path).toBe(repoPath);
  });

  it('discovers nested skills up to depth 3', () => {
    writeSkillMd(repoPath, 'repo-root', 'Root');
    writeSkillMd(join(repoPath, 'openclaw', 'skills', 'my-skill'), 'my-skill', 'Deep skill');

    const skills = collectGitCloneSkills(repoPath);
    expect(skills.map((s) => s.name)).toEqual(['my-skill']);
  });

  it('discovers both depth-1 and depth-3 skills in fallback scan', () => {
    writeSkillMd(join(repoPath, 'qa'), 'qa', 'QA skill');
    writeSkillMd(join(repoPath, 'openclaw', 'skills', 'deep-skill'), 'deep-skill', 'Deep skill');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['deep-skill', 'qa']);
  });

  it('discovers skills at repo root when no standard paths exist', () => {
    writeSkillMd(join(repoPath, 'tdd'), 'tdd', 'TDD skill');
    writeSkillMd(join(repoPath, 'qa'), 'qa', 'QA skill');
    writeSkillMd(join(repoPath, 'write-a-skill'), 'write-a-skill', 'Write a skill');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['qa', 'tdd', 'write-a-skill']);
  });

  it('prefers standard paths over root scan', () => {
    writeSkillMd(join(repoPath, 'skills', 'standard-skill'), 'standard-skill', 'Standard');
    writeSkillMd(join(repoPath, 'root-skill'), 'root-skill', 'Root');

    const skills = collectGitCloneSkills(repoPath);
    expect(skills.map((s) => s.name)).toEqual(['standard-skill']);
  });

  it('discovers skills in curated/experimental/system subdirectories', () => {
    writeSkillMd(join(repoPath, 'skills', '.curated', 'curated-skill'), 'curated-skill', 'Curated');
    writeSkillMd(join(repoPath, 'skills', '.experimental', 'exp-skill'), 'exp-skill', 'Experimental');
    writeSkillMd(join(repoPath, 'skills', '.system', 'sys-skill'), 'sys-skill', 'System');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(['curated-skill', 'exp-skill', 'sys-skill']);
  });

  it('simulates microsoft/skills structure with pluginRoot-relative source', () => {
    mkdirSync(join(repoPath, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(repoPath, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        metadata: { pluginRoot: './.github/plugins' },
        plugins: [
          { name: 'azure-sdk-python', source: './azure-sdk-python', skills: 'skills/' },
          { name: 'azure-sdk-ts', source: './azure-sdk-ts', skills: 'skills/' },
          { name: 'azure-skills', source: './azure-skills', skills: 'skills/' },
        ],
      }),
    );

    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-python', 'skills', 'azure-identity-py'), 'azure-identity-py', 'Identity');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-python', 'skills', 'azure-storage-py'), 'azure-storage-py', 'Storage');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-ts', 'skills', 'azure-identity-ts'), 'azure-identity-ts', 'Identity TS');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-skills', 'skills', 'azure-deploy'), 'azure-deploy', 'Deploy');

    writeSkillMd(join(repoPath, 'skills', 'top-level-skill'), 'top-level-skill', 'Top');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual([
      'azure-deploy',
      'azure-identity-py',
      'azure-identity-ts',
      'azure-storage-py',
      'top-level-skill',
    ]);
  });

  it('simulates microsoft/skills structure with repo-root-relative source', () => {
    mkdirSync(join(repoPath, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(repoPath, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        metadata: { pluginRoot: './.github/plugins' },
        plugins: [
          { name: 'azure-sdk-python', source: './.github/plugins/azure-sdk-python', skills: ['./skills/'] },
          { name: 'azure-sdk-ts', source: './.github/plugins/azure-sdk-ts', skills: ['./skills/'] },
          { name: 'azure-skills', source: './.github/plugins/azure-skills', skills: ['./skills/'] },
        ],
      }),
    );

    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-python', 'skills', 'azure-identity-py'), 'azure-identity-py', 'Identity');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-python', 'skills', 'azure-storage-py'), 'azure-storage-py', 'Storage');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-sdk-ts', 'skills', 'azure-identity-ts'), 'azure-identity-ts', 'Identity TS');
    writeSkillMd(join(repoPath, '.github', 'plugins', 'azure-skills', 'skills', 'azure-deploy'), 'azure-deploy', 'Deploy');

    const skills = collectGitCloneSkills(repoPath);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual([
      'azure-deploy',
      'azure-identity-py',
      'azure-identity-ts',
      'azure-storage-py',
    ]);
  });
});

describe('executeInstall git bundle tracking', () => {
  let repoPath: string;
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    repoPath = join(tmpdir(), `skillsmgr-git-fixture-${id}`);
    testManagerDir = join(tmpdir(), `skillsmgr-git-install-mgr-${id}`);
    testProjectDir = join(tmpdir(), `skillsmgr-git-install-proj-${id}`);

    mkdirSync(repoPath, { recursive: true });
    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(testProjectDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    gitCloneState.repoPath = '';
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readSources() {
    return JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
  }

  it('writes a git bundle entry for repo installs', async () => {
    writeSkillMd(join(repoPath, 'skills', 'alpha'), 'alpha', 'Alpha');
    writeSkillMd(join(repoPath, 'skills', 'beta'), 'beta', 'Beta');
    gitCloneState.repoPath = repoPath;

    await executeInstall('anthropics/skills', { all: true });

    expect(existsSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'alpha', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testManagerDir, 'official', 'anthropic', 'skills', 'beta', 'SKILL.md'))).toBe(true);

    const sources = readSources();
    expect(sources.bundles['git:https://github.com/anthropics/skills']).toMatchObject({
      type: 'git',
      url: 'https://github.com/anthropics/skills',
      selectionMode: 'all',
      members: ['official/anthropic/skills'],
    });
  });
});

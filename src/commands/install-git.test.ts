import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { collectGitCloneSkills } from './install-git.js';

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

  it('simulates microsoft/skills structure', () => {
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

    // Top-level skills (like .github/skills/ - reachable via recursive scan)
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
});

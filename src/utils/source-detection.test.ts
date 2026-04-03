import { describe, it, expect } from 'vitest';
import { detectSourceType, hasExplicitLocalPrefix, isZipLikeExtension, extractOwnerRepo, parseRegistryInput, parseOwnerRepoSkill } from './source-detection.js';

describe('detectSourceType', () => {
  it('detects bare package names as registry', () => {
    expect(detectSourceType('my-skill')).toBe('registry');
    expect(detectSourceType('anthropic')).toBe('registry');
    expect(detectSourceType('foo-bar')).toBe('registry');
    expect(detectSourceType('code-review')).toBe('registry');
  });

  it('detects explicit local path prefixes', () => {
    expect(hasExplicitLocalPrefix('~')).toBe(true);
    expect(hasExplicitLocalPrefix('~/my-skill')).toBe(true);
    expect(hasExplicitLocalPrefix('./my-skill')).toBe(true);
    expect(hasExplicitLocalPrefix('my-skill')).toBe(false);

    expect(detectSourceType('./my-skill')).toBe('local-path');
    expect(detectSourceType('../my-skill')).toBe('local-path');
    expect(detectSourceType('/tmp/my-skill')).toBe('local-path');
    expect(detectSourceType('~/my-skill')).toBe('local-path');
  });

  it('detects zip inputs with remote zip priority', () => {
    expect(detectSourceType('./my-skill.zip')).toBe('local-zip');
    expect(detectSourceType('../my-skill.zip')).toBe('local-zip');
    expect(detectSourceType('/tmp/my-skill.zip')).toBe('local-zip');
    expect(detectSourceType('~/my-skill.zip')).toBe('local-zip');
    expect(detectSourceType('my-skill.zip')).toBe('registry');
    expect(detectSourceType('http://example.com/my-skill.zip')).toBe('remote-zip');
    expect(detectSourceType('https://example.com/my-skill.zip')).toBe('remote-zip');
  });

  it('detects .skill extension as zip-like', () => {
    expect(isZipLikeExtension('foo.skill')).toBe(true);
    expect(isZipLikeExtension('foo.zip')).toBe(true);
    expect(isZipLikeExtension('foo.tar.gz')).toBe(false);

    expect(detectSourceType('./foo.skill')).toBe('local-zip');
    expect(detectSourceType('../foo.skill')).toBe('local-zip');
    expect(detectSourceType('/path/to/foo.skill')).toBe('local-zip');
    expect(detectSourceType('~/foo.skill')).toBe('local-zip');
    expect(detectSourceType('foo.skill')).toBe('registry');
    expect(detectSourceType('http://example.com/foo.skill')).toBe('remote-zip');
    expect(detectSourceType('https://example.com/foo.skill')).toBe('remote-zip');
  });

  it('detects remote URLs', () => {
    expect(detectSourceType('http://example.com/repo')).toBe('remote-url');
    expect(detectSourceType('https://github.com/owner/repo')).toBe('remote-url');
    expect(detectSourceType('git@github.com:owner/repo.git')).toBe('remote-url');
  });

  it('detects owner/repo shorthand', () => {
    expect(detectSourceType('owner/repo')).toBe('owner-repo');
    expect(detectSourceType('owner/repo/')).toBe('owner-repo');
  });

  it('detects owner/repo:skillName format', () => {
    expect(detectSourceType('anthropics/skills:git-diff-parser')).toBe('owner-repo-skill');
    expect(detectSourceType('obra/superpowers:brainstorming')).toBe('owner-repo-skill');
  });
});

describe('parseOwnerRepoSkill', () => {
  it('parses valid owner/repo:skillName', () => {
    expect(parseOwnerRepoSkill('anthropics/skills:git-diff-parser')).toEqual({
      type: 'owner-repo-skill',
      owner: 'anthropics',
      repo: 'skills',
      skillName: 'git-diff-parser',
    });
  });

  it('returns null for owner/repo without skill name', () => {
    expect(parseOwnerRepoSkill('owner/repo')).toBeNull();
  });

  it('returns null for bare package names', () => {
    expect(parseOwnerRepoSkill('base-prompts')).toBeNull();
  });
});

describe('parseRegistryInput', () => {
  it('parses bare package names', () => {
    expect(parseRegistryInput('code-review')).toEqual({
      type: 'registry',
      packageName: 'code-review',
    });
  });

  it('parses bare package name with version', () => {
    expect(parseRegistryInput('code-review@1.0.0')).toEqual({
      type: 'registry',
      packageName: 'code-review',
      requestedVersion: '1.0.0',
    });
  });

  it('parses scoped package names', () => {
    expect(parseRegistryInput('@anthropic/code-review')).toEqual({
      type: 'registry',
      packageName: '@anthropic/code-review',
    });
  });

  it('parses scoped package name with version', () => {
    expect(parseRegistryInput('@anthropic/code-review@2.0.0')).toEqual({
      type: 'registry',
      packageName: '@anthropic/code-review',
      requestedVersion: '2.0.0',
    });
  });

  it('returns null for URLs', () => {
    expect(parseRegistryInput('https://github.com/owner/repo')).toBeNull();
  });

  it('returns null for local paths', () => {
    expect(parseRegistryInput('./my-skill')).toBeNull();
    expect(parseRegistryInput('~/skills/review')).toBeNull();
    expect(parseRegistryInput('/tmp/skill')).toBeNull();
  });

  it('returns null for owner/repo format', () => {
    expect(parseRegistryInput('anthropics/skills')).toBeNull();
  });

  it('returns null for invalid package names', () => {
    expect(parseRegistryInput('My_Skill!')).toBeNull();
    expect(parseRegistryInput('UPPERCASE')).toBeNull();
  });

  it('does not conflict with owner-repo detection', () => {
    // owner/repo should be detected first, not as registry
    expect(detectSourceType('anthropics/skills')).toBe('owner-repo');
  });

  it('does not conflict with local-path detection', () => {
    expect(detectSourceType('./my-skill')).toBe('local-path');
    expect(detectSourceType('~/skills/review')).toBe('local-path');
  });
});

describe('extractOwnerRepo', () => {
  it('extracts from HTTPS URL (GitHub)', () => {
    expect(extractOwnerRepo('https://github.com/openai/skills')).toBe('openai/skills');
  });

  it('extracts from HTTPS URL (GitLab)', () => {
    expect(extractOwnerRepo('https://gitlab.com/foo/bar')).toBe('foo/bar');
  });

  it('handles HTTPS URL with trailing slash', () => {
    expect(extractOwnerRepo('https://github.com/openai/skills/')).toBe('openai/skills');
  });

  it('handles HTTPS URL with .git suffix', () => {
    expect(extractOwnerRepo('https://github.com/openai/skills.git')).toBe('openai/skills');
  });

  it('extracts from SSH URL', () => {
    expect(extractOwnerRepo('git@github.com:openai/skills.git')).toBe('openai/skills');
  });

  it('extracts from SSH URL without .git suffix', () => {
    expect(extractOwnerRepo('git@gitlab.com:foo/bar')).toBe('foo/bar');
  });

  it('returns owner/repo as-is', () => {
    expect(extractOwnerRepo('openai/skills')).toBe('openai/skills');
  });

  it('handles owner/repo with trailing slash', () => {
    expect(extractOwnerRepo('openai/skills/')).toBe('openai/skills');
  });

  it('returns null for plain skill name', () => {
    expect(extractOwnerRepo('commit')).toBeNull();
  });

  it('returns null for URL with insufficient path segments', () => {
    expect(extractOwnerRepo('https://example.com/')).toBeNull();
  });
});

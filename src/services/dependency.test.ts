import { describe, it, expect } from 'vitest';
import { parseDependencyIdentifier } from './dependency.js';

describe('parseDependencyIdentifier', () => {
  it('parses bare package name as registry dependency', () => {
    expect(parseDependencyIdentifier('base-prompts')).toEqual({
      type: 'registry',
      packageName: 'base-prompts',
    });
  });

  it('parses scoped package name as registry dependency', () => {
    expect(parseDependencyIdentifier('@anthropic/code-review')).toEqual({
      type: 'registry',
      packageName: '@anthropic/code-review',
    });
  });

  it('parses owner/repo:skillName as github-skill dependency', () => {
    expect(parseDependencyIdentifier('anthropics/skills:git-diff-parser')).toEqual({
      type: 'github-skill',
      owner: 'anthropics',
      repo: 'skills',
      skillName: 'git-diff-parser',
    });
  });

  it('parses owner/repo as github-repo dependency', () => {
    expect(parseDependencyIdentifier('obra/superpowers')).toEqual({
      type: 'github-repo',
      owner: 'obra',
      repo: 'superpowers',
    });
  });

  it('handles complex skill names in owner/repo:skillName', () => {
    expect(parseDependencyIdentifier('org/repo:my-complex.skill')).toEqual({
      type: 'github-skill',
      owner: 'org',
      repo: 'repo',
      skillName: 'my-complex.skill',
    });
  });

  it('treats single word without special chars as registry', () => {
    expect(parseDependencyIdentifier('simple')).toEqual({
      type: 'registry',
      packageName: 'simple',
    });
  });

  it('handles trailing slash on owner/repo', () => {
    expect(parseDependencyIdentifier('obra/superpowers/')).toEqual({
      type: 'github-repo',
      owner: 'obra',
      repo: 'superpowers',
    });
  });

  it('handles trailing slash on owner/repo with multiple slashes', () => {
    expect(parseDependencyIdentifier('obra/superpowers//')).toEqual({
      type: 'github-repo',
      owner: 'obra',
      repo: 'superpowers',
    });
  });
});

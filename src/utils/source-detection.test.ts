import { describe, it, expect } from 'vitest';
import { detectSourceType, hasExplicitLocalPrefix, isZipLikeExtension, extractOwnerRepo } from './source-detection.js';

describe('detectSourceType', () => {
  it('returns unknown for bare words', () => {
    expect(detectSourceType('my-skill')).toBe('unknown');
    expect(detectSourceType('anthropic')).toBe('unknown');
    expect(detectSourceType('foo-bar')).toBe('unknown');
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
    expect(detectSourceType('my-skill.zip')).toBe('unknown');
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
    expect(detectSourceType('foo.skill')).toBe('unknown');
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

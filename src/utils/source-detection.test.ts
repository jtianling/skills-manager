import { describe, it, expect } from 'vitest';
import { detectSourceType, hasExplicitLocalPrefix, isZipLikeExtension } from './source-detection.js';

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

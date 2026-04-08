import { describe, expect, it } from 'vitest';
import { homedir } from 'os';
import { resolve } from 'path';
import {
  makeBundleId,
  normalizeGitUrl,
  normalizeLocalPath,
} from './url-normalize.js';

describe('url normalize utils', () => {
  it('normalizes git ssh and https urls to the same canonical form', () => {
    expect(normalizeGitUrl('git@GitHub.com:OpenAI/skills.git')).toBe(
      'https://github.com/OpenAI/skills',
    );
    expect(normalizeGitUrl('https://github.com/OpenAI/skills.git/')).toBe(
      'https://github.com/OpenAI/skills',
    );
  });

  it('returns null for invalid git url input', () => {
    expect(normalizeGitUrl('not a git url')).toBeNull();
  });

  it('normalizes local paths by expanding home and resolving relative input', () => {
    expect(normalizeLocalPath('~/skills/example')).toBe(
      resolve(homedir(), 'skills/example'),
    );
    expect(normalizeLocalPath('./fixtures/example')).toBe(
      resolve(process.cwd(), './fixtures/example'),
    );
  });

  it('builds bundle ids from type and normalized url', () => {
    expect(makeBundleId('git', 'https://github.com/openai/skills')).toBe(
      'git:https://github.com/openai/skills',
    );
  });
});

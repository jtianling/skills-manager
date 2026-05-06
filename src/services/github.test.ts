import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import { GitHubService } from './github.js';

const SKILLS_DIR = join(homedir(), '.skills-manager');

describe('GitHubService', () => {
  const service = new GitHubService();

  describe('getTargetDir', () => {
    it('returns official path with repo layer for anthropics/skills', () => {
      const dir = service.getTargetDir('anthropics', 'skills', 'code-review');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'anthropic', 'skills', 'code-review'));
    });

    it('returns official path with repo layer for openai/skills', () => {
      const dir = service.getTargetDir('openai', 'skills', 'figma');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'openai', 'skills', 'figma'));
    });

    it('returns official path with repo layer for microsoft/skills', () => {
      const dir = service.getTargetDir('microsoft', 'skills', 'mcp-builder');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'microsoft', 'skills', 'mcp-builder'));
    });

    it('returns official path with repo layer for vercel-labs/agent-skills', () => {
      const dir = service.getTargetDir('vercel-labs', 'agent-skills', 'deploy');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'vercel-labs', 'agent-skills', 'deploy'));
    });

    it('returns official path for owner match with unknown repo', () => {
      const dir = service.getTargetDir('vercel-labs', 'unknown-repo', 'some-skill');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'vercel-labs', 'unknown-repo', 'some-skill'));
    });

    it('returns community path with owner/repo for non-official', () => {
      const dir = service.getTargetDir('obra', 'superpowers', 'tdd');
      expect(dir).toBe(join(SKILLS_DIR, 'community', 'obra', 'superpowers', 'tdd'));
    });

    it('returns custom path when isCustom is true', () => {
      const dir = service.getTargetDir('obra', 'superpowers', 'tdd', true);
      expect(dir).toBe(join(SKILLS_DIR, 'custom', 'superpowers', 'tdd'));
    });

    it('prefers official over community even without isCustom', () => {
      const dir = service.getTargetDir('anthropics', 'skills', 'code-review', false);
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'anthropic', 'skills', 'code-review'));
    });
  });

  describe('parseGitHubUrl', () => {
    it('returns owner and repo for basic URL', () => {
      expect(service.parseGitHubUrl('https://github.com/owner/repo')).toEqual({
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('strips .git suffix', () => {
      expect(service.parseGitHubUrl('https://github.com/owner/repo.git')).toEqual({
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('returns owner, repo, branch, path for tree URL', () => {
      expect(
        service.parseGitHubUrl('https://github.com/owner/repo/tree/main/skills/foo'),
      ).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'skills/foo',
      });
    });

    it('returns null for non-GitHub URL', () => {
      expect(service.parseGitHubUrl('https://example.com/foo/bar')).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import { GitHubService } from './github.js';

const SKILLS_DIR = join(homedir(), '.skills-manager');

describe('GitHubService', () => {
  const service = new GitHubService();

  describe('getTargetDir', () => {
    it('returns official path for anthropics/skills', () => {
      const dir = service.getTargetDir('anthropics', 'skills', 'code-review');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'anthropic', 'code-review'));
    });

    it('returns official path for openai/skills', () => {
      const dir = service.getTargetDir('openai', 'skills', 'figma');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'openai', 'figma'));
    });

    it('returns official path for microsoft/skills', () => {
      const dir = service.getTargetDir('microsoft', 'skills', 'mcp-builder');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'microsoft', 'mcp-builder'));
    });

    it('returns official path for vercel-labs/agent-skills', () => {
      const dir = service.getTargetDir('vercel-labs', 'agent-skills', 'deploy');
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'vercel-labs', 'deploy'));
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
      expect(dir).toBe(join(SKILLS_DIR, 'official', 'anthropic', 'code-review'));
    });
  });
});

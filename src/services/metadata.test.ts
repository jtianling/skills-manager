import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MetadataService } from './metadata.js';

describe('MetadataService', () => {
  const testDir = join(tmpdir(), `skillsmgr-metadata-test-${Date.now()}`);
  let service: MetadataService;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    service = new MetadataService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('returns default metadata if file does not exist', () => {
      const metadata = service.load();
      expect(metadata.version).toBe('1.0');
      expect(metadata.tools).toEqual({});
    });
  });

  describe('save', () => {
    it('creates metadata file', () => {
      service.save({ version: '1.0', tools: {} });
      expect(existsSync(join(testDir, '.skillsmgr.json'))).toBe(true);
    });
  });

  describe('addDeployment', () => {
    it('adds tool deployment', () => {
      service.addDeployment('claude-code', '.claude/skills', 'all', [
        { name: 'test-skill', source: 'official/anthropic', deployMode: 'link' },
      ]);
      const metadata = service.load();
      expect(metadata.tools['claude-code']).toBeDefined();
      expect(metadata.tools['claude-code'].skills.length).toBe(1);
    });
  });

  describe('getDeployedSkills', () => {
    it('returns deployed skills for tool', () => {
      service.addDeployment('claude-code', '.claude/skills', 'all', [
        { name: 'test-skill', source: 'official/anthropic', deployMode: 'link' },
      ]);
      const skills = service.getDeployedSkills('claude-code');
      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('test-skill');
    });
  });
});

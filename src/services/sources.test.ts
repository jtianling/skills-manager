import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../constants.js', async () => {
  const testDir = join(tmpdir(), `skillsmgr-sources-test-${process.pid}-${Date.now()}`);
  return { SKILLS_MANAGER_DIR: testDir };
});

import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SourcesService } from './sources.js';

describe('SourcesService', () => {
  let service: SourcesService;

  beforeEach(() => {
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
    service = new SourcesService();
  });

  afterEach(() => {
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
  });

  it('returns empty object when sources.json does not exist', () => {
    const sources = service.getAllSources();
    expect(sources).toEqual({});
  });

  it('adds a new source with timestamps', () => {
    service.addSource('official/anthropic/skills', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'skills',
    });

    const source = service.getSource('official/anthropic/skills');
    expect(source).toBeDefined();
    expect(source!.url).toBe('https://github.com/anthropics/skills');
    expect(source!.type).toBe('official');
    expect(source!.installedAt).toBeDefined();
    expect(source!.updatedAt).toBeDefined();
  });

  it('preserves installedAt when updating existing source', () => {
    service.addSource('community/org/repo', {
      url: 'https://github.com/org/repo',
      type: 'community',
      repoName: 'repo',
    });

    const firstInstalledAt = service.getSource('community/org/repo')!.installedAt;

    service.addSource('community/org/repo', {
      url: 'https://github.com/org/repo-updated',
      type: 'community',
      repoName: 'repo',
    });

    const updated = service.getSource('community/org/repo')!;
    expect(updated.installedAt).toBe(firstInstalledAt);
    expect(updated.url).toBe('https://github.com/org/repo-updated');
  });

  it('removes a source', () => {
    service.addSource('custom/my-repo', {
      url: 'https://github.com/me/my-repo',
      type: 'custom',
      repoName: 'my-repo',
    });

    service.removeSource('custom/my-repo');
    expect(service.getSource('custom/my-repo')).toBeUndefined();
  });

  it('returns all sources', () => {
    service.addSource('key1', { url: 'u1', type: 'official', repoName: 'r1' });
    service.addSource('key2', { url: 'u2', type: 'community', repoName: 'r2' });

    const all = service.getAllSources();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['key1']).toBeDefined();
    expect(all['key2']).toBeDefined();
  });

  it('updates timestamp for existing source', () => {
    service.addSource('k', { url: 'u', type: 'official', repoName: 'r' });
    const before = service.getSource('k')!.updatedAt;

    service.updateTimestamp('k');
    const after = service.getSource('k')!.updatedAt;

    expect(after).toBeDefined();
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it('does nothing when updating timestamp for non-existent key', () => {
    service.updateTimestamp('nonexistent');
    expect(service.getSource('nonexistent')).toBeUndefined();
  });
});

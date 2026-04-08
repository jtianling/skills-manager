import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SourcesService } from './sources.js';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { makeBundleId, normalizeGitUrl, normalizeLocalPath } from '../utils/url-normalize.js';

vi.mock('../constants.js', async () => {
  const testDir = join(tmpdir(), `skillsmgr-sources-test-${process.pid}-${Date.now()}`);
  return { SKILLS_MANAGER_DIR: testDir };
});

describe('SourcesService', () => {
  let service: SourcesService;
  let sourcesFile: string;
  let tempFile: string;

  beforeEach(() => {
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
    service = new SourcesService();
    sourcesFile = join(SKILLS_MANAGER_DIR, 'sources.json');
    tempFile = `${sourcesFile}.tmp`;
  });

  afterEach(() => {
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('returns empty v2 structures when sources.json does not exist', () => {
    expect(service.getAllSources()).toEqual({});
    expect(service.getAllBundles()).toEqual({});
  });

  it('adds a new source and writes schema version 2.0', () => {
    service.addSource('official/anthropic/skills', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'skills',
    });

    const source = service.getSource('official/anthropic/skills');
    expect(source).toBeDefined();
    expect(source!.url).toBe('https://github.com/anthropics/skills');

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.version).toBe('2.0');
    expect(stored.bundles).toEqual({});
  });

  it('preserves installedAt when updating an existing source', () => {
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

  it('supports bundle CRUD and preserves bundle installedAt', () => {
    const id = makeBundleId('local-batch', '/tmp/spec-tdd');

    service.addBundle(id, {
      type: 'local-batch',
      url: '/tmp/spec-tdd',
      selectionMode: 'all',
      members: ['custom/spec-tdd/a', 'custom/spec-tdd/b'],
    });

    const created = service.getBundle(id);
    expect(created).toBeDefined();
    expect(service.getAllBundles()[id]).toEqual(created);

    const installedAt = created!.installedAt;

    service.addBundle(id, {
      type: 'local-batch',
      url: '/tmp/spec-tdd',
      selectionMode: 'subset',
      members: ['custom/spec-tdd/a'],
    });

    const updated = service.getBundle(id)!;
    expect(updated.installedAt).toBe(installedAt);
    expect(updated.selectionMode).toBe('subset');
    expect(updated.members).toEqual(['custom/spec-tdd/a']);

    service.updateBundleMembers(id, ['custom/spec-tdd/a', 'custom/spec-tdd/c']);
    expect(service.getBundle(id)!.members).toEqual([
      'custom/spec-tdd/a',
      'custom/spec-tdd/c',
    ]);

    const before = service.getBundle(id)!.updatedAt;
    service.updateBundleTimestamp(id);
    expect(new Date(service.getBundle(id)!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime(),
    );

    service.removeBundle(id);
    expect(service.getBundle(id)).toBeUndefined();
  });

  it('finds git bundle by normalized url', () => {
    const normalized = normalizeGitUrl('git@GitHub.com:OpenAI/skills.git');
    expect(normalized).toBe('https://github.com/OpenAI/skills');

    const id = makeBundleId('git', normalized!);
    service.addBundle(id, {
      type: 'git',
      url: normalized!,
      selectionMode: 'all',
      members: ['community/openai/skills'],
    });

    const found = service.findBundleByUrl(
      normalizeGitUrl('https://github.com/OpenAI/skills.git')!,
      'git',
    );

    expect(found).toBeDefined();
    expect(found!.url).toBe(normalized);
  });

  it('migrates version 1.0 data to 2.0 with local and git bundles', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        version: '1.0',
        sources: {
          'custom/spec-tdd/a': {
            url: './fixtures/spec-tdd',
            type: 'custom',
            repoName: 'a',
            installMethod: 'local-copy',
            installedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          'custom/spec-tdd/b': {
            url: './fixtures/spec-tdd',
            type: 'custom',
            repoName: 'b',
            installMethod: 'local-copy',
            installedAt: '2026-04-01T00:00:01.000Z',
            updatedAt: '2026-04-01T00:00:01.000Z',
          },
          'community/acme/repo-a': {
            url: 'git@github.com:acme/repo.git',
            type: 'community',
            repoName: 'repo',
            installMethod: 'git',
            installedAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
          'community/acme/repo-b': {
            url: 'https://github.com/acme/repo',
            type: 'community',
            repoName: 'repo',
            installMethod: 'git',
            installedAt: '2026-04-02T00:00:01.000Z',
            updatedAt: '2026-04-02T00:00:01.000Z',
          },
          'custom/single': {
            url: './fixtures/single',
            type: 'custom',
            repoName: 'single',
            installMethod: 'local-copy',
            installedAt: '2026-04-03T00:00:00.000Z',
            updatedAt: '2026-04-03T00:00:00.000Z',
          },
        },
      }, null, 2),
    );

    const bundles = service.getAllBundles();
    const localId = makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd'));
    const gitId = makeBundleId('git', 'https://github.com/acme/repo');

    expect(bundles[localId]).toMatchObject({
      type: 'local-batch',
      url: normalizeLocalPath('./fixtures/spec-tdd'),
      selectionMode: 'all',
      members: ['custom/spec-tdd/a', 'custom/spec-tdd/b'],
    });
    expect(bundles[gitId]).toMatchObject({
      type: 'git',
      url: 'https://github.com/acme/repo',
      selectionMode: 'all',
      members: ['community/acme/repo-a', 'community/acme/repo-b'],
    });
    expect(Object.values(bundles).some((bundle) => bundle.members.includes('custom/single'))).toBe(false);

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.version).toBe('2.0');
    expect(stored.bundles[localId]).toBeDefined();
    expect(stored.bundles[gitId]).toBeDefined();
  });

  it('treats missing version as v1 and returns migrated data even if write-back fails', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        sources: {
          'custom/spec-tdd/a': {
            url: './fixtures/spec-tdd',
            type: 'custom',
            repoName: 'a',
            installMethod: 'local-copy',
            installedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          'custom/spec-tdd/b': {
            url: './fixtures/spec-tdd',
            type: 'custom',
            repoName: 'b',
            installMethod: 'local-copy',
            installedAt: '2026-04-01T00:00:01.000Z',
            updatedAt: '2026-04-01T00:00:01.000Z',
          },
        },
      }, null, 2),
    );
    mkdirSync(tempFile, { recursive: true });

    const bundles = service.getAllBundles();
    const localId = makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd'));

    expect(bundles[localId]).toBeDefined();

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.version).toBeUndefined();
    expect(stored.bundles).toBeUndefined();
  });

  it('uses temp file writes without corrupting the original file on failure', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        version: '2.0',
        sources: {
          existing: {
            url: 'https://example.com/repo',
            type: 'community',
            repoName: 'repo',
            installedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        },
        bundles: {},
      }, null, 2),
    );
    mkdirSync(tempFile, { recursive: true });

    expect(() => {
      service.addSource('new-key', {
        url: 'https://example.com/new',
        type: 'community',
        repoName: 'new',
      });
    }).toThrow();

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.sources).toEqual({
      existing: {
        url: 'https://example.com/repo',
        type: 'community',
        repoName: 'repo',
        installedAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    });
  });
});

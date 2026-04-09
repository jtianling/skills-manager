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

  it('rebinds a local batch bundle atomically and keeps unrelated entries intact', () => {
    const oldUrl = normalizeLocalPath('./fixtures/spec-tdd');
    const newUrl = normalizeLocalPath('./fixtures/spec-tdd-renamed');
    const bundleId = makeBundleId('local-batch', oldUrl);
    const saveSpy = vi.spyOn(service as never, 'save' as never);

    service.addSource('custom/spec-tdd/a', {
      url: oldUrl,
      type: 'custom',
      repoName: 'a',
      installMethod: 'local-copy',
    });
    service.addSource('custom/spec-tdd/b', {
      url: oldUrl,
      type: 'custom',
      repoName: 'b',
      installMethod: 'local-copy',
    });
    service.addSource('custom/other', {
      url: normalizeLocalPath('./fixtures/other'),
      type: 'custom',
      repoName: 'other',
      installMethod: 'local-copy',
    });
    service.addBundle(bundleId, {
      type: 'local-batch',
      url: oldUrl,
      selectionMode: 'all',
      members: ['custom/spec-tdd/a', 'custom/spec-tdd/b'],
    });

    saveSpy.mockClear();

    const result = service.rebindLocalBundle(bundleId, newUrl);
    const reboundBundle = service.getBundle(result.newBundleId);

    expect(result.newBundleId).toBe(makeBundleId('local-batch', newUrl));
    expect(service.getBundle(bundleId)).toBeUndefined();
    expect(reboundBundle).toMatchObject({
      type: 'local-batch',
      url: newUrl,
      members: ['custom/spec-tdd/a', 'custom/spec-tdd/b'],
    });
    expect(service.getSource('custom/spec-tdd/a')!.url).toBe(newUrl);
    expect(service.getSource('custom/spec-tdd/b')!.url).toBe(newUrl);
    expect(service.getSource('custom/other')!.url).toBe(
      normalizeLocalPath('./fixtures/other'),
    );
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('fails rebindLocalBundle when bundle members are missing and does not modify sources.json', () => {
    const oldUrl = normalizeLocalPath('./fixtures/spec-tdd');
    const newUrl = normalizeLocalPath('./fixtures/spec-tdd-renamed');
    const bundleId = makeBundleId('local-batch', oldUrl);

    service.addSource('custom/spec-tdd/a', {
      url: oldUrl,
      type: 'custom',
      repoName: 'a',
      installMethod: 'local-copy',
    });
    service.addBundle(bundleId, {
      type: 'local-batch',
      url: oldUrl,
      selectionMode: 'all',
      members: ['custom/spec-tdd/a', 'custom/spec-tdd/missing'],
    });

    const before = readFileSync(sourcesFile, 'utf-8');

    expect(() => service.rebindLocalBundle(bundleId, newUrl)).toThrow(
      `Cannot rebind bundle ${bundleId}: dangling members in sources.json: ` +
        'custom/spec-tdd/missing. Clean up sources.json and retry.',
    );
    expect(readFileSync(sourcesFile, 'utf-8')).toBe(before);
  });

  it('rebinds a local single source', () => {
    const oldUrl = normalizeLocalPath('./fixtures/my-lint');
    const newUrl = normalizeLocalPath('./fixtures/my-lint-renamed');

    service.addSource('custom/my-lint', {
      url: oldUrl,
      type: 'custom',
      repoName: 'my-lint',
      installMethod: 'local-copy',
    });

    service.rebindLocalSource('custom/my-lint', newUrl);

    expect(service.getSource('custom/my-lint')).toMatchObject({
      url: newUrl,
      repoName: 'my-lint',
      installMethod: 'local-copy',
    });
  });

  it('finds local bundle and source candidates by basename', () => {
    const bundleUrlA = normalizeLocalPath('./fixtures/tdd-spec');
    const bundleUrlB = normalizeLocalPath('./other/tdd-spec');
    const sourceUrl = normalizeLocalPath('./fixtures/my-lint');

    service.addBundle(makeBundleId('local-batch', bundleUrlA), {
      type: 'local-batch',
      url: bundleUrlA,
      selectionMode: 'all',
      members: ['custom/tdd-spec/a'],
    });
    service.addBundle(makeBundleId('local-batch', bundleUrlB), {
      type: 'local-batch',
      url: bundleUrlB,
      selectionMode: 'all',
      members: ['custom/tdd-spec/b'],
    });
    service.addBundle(makeBundleId('git', 'https://github.com/acme/repo'), {
      type: 'git',
      url: 'https://github.com/acme/repo',
      selectionMode: 'all',
      members: ['community/acme/repo'],
    });
    service.addSource('custom/my-lint', {
      url: sourceUrl,
      type: 'custom',
      repoName: 'my-lint',
      installMethod: 'local-copy',
    });
    service.addSource('custom/other', {
      url: normalizeLocalPath('./fixtures/other'),
      type: 'custom',
      repoName: 'other',
      installMethod: 'local-copy',
    });

    expect(service.findLocalBatchBundlesByBasename('missing')).toEqual([]);
    expect(service.findLocalBatchBundlesByBasename('tdd-spec')).toHaveLength(2);
    expect(service.findLocalCopySourcesByBasename('missing')).toEqual([]);
    expect(service.findLocalCopySourcesByBasename('my-lint')).toEqual([
      {
        key: 'custom/my-lint',
        info: expect.objectContaining({
          url: sourceUrl,
          repoName: 'my-lint',
        }),
      },
    ]);
  });

  it('does not return batch-member local-copy sources when searching by basename', () => {
    service.addSource('custom/my-tools/foo', {
      url: normalizeLocalPath('./fixtures/my-tools'),
      type: 'custom',
      repoName: 'foo',
      installMethod: 'local-copy',
    });

    expect(service.findLocalCopySourcesByBasename('foo')).toEqual([]);
  });

  it('returns top-level custom local-copy sources when searching by basename', () => {
    const sourceUrl = normalizeLocalPath('./fixtures/foo');

    service.addSource('custom/foo', {
      url: sourceUrl,
      type: 'custom',
      repoName: 'foo',
      installMethod: 'local-copy',
    });

    expect(service.findLocalCopySourcesByBasename('foo')).toEqual([
      {
        key: 'custom/foo',
        info: expect.objectContaining({
          url: sourceUrl,
          repoName: 'foo',
        }),
      },
    ]);
  });

  it('returns only the top-level custom local-copy source when top-level and batch-member keys coexist', () => {
    const topLevelUrl = normalizeLocalPath('./fixtures/foo');

    service.addSource('custom/foo', {
      url: topLevelUrl,
      type: 'custom',
      repoName: 'foo',
      installMethod: 'local-copy',
    });
    service.addSource('custom/bar/foo', {
      url: normalizeLocalPath('./fixtures/bar'),
      type: 'custom',
      repoName: 'foo',
      installMethod: 'local-copy',
    });

    expect(service.findLocalCopySourcesByBasename('foo')).toEqual([
      {
        key: 'custom/foo',
        info: expect.objectContaining({
          url: topLevelUrl,
          repoName: 'foo',
        }),
      },
    ]);
  });
});

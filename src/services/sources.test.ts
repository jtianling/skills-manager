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
import { GroupsService } from './groups.js';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { makeBundleId, normalizeGitUrl, normalizeLocalPath } from '../utils/url-normalize.js';

vi.mock('../constants.js', async () => {
  const testDir = join(tmpdir(), `skillsmgr-sources-test-${process.pid}-${Date.now()}`);
  return { SKILLS_MANAGER_DIR: testDir };
});

function createPhysicalSkill(groupName: string, skillName: string): void {
  const dir = join(SKILLS_MANAGER_DIR, 'custom', groupName, skillName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skillName}\n---\n`);
}

describe('SourcesService', () => {
  let service: SourcesService;
  let groupsService: GroupsService;
  let sourcesFile: string;
  let tempFile: string;

  beforeEach(() => {
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
    groupsService = new GroupsService();
    service = new SourcesService(groupsService);
    sourcesFile = join(SKILLS_MANAGER_DIR, 'sources.json');
    tempFile = `${sourcesFile}.tmp`;
  });

  afterEach(() => {
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('returns empty v3 structures when sources.json does not exist', () => {
    expect(service.getAllSources()).toEqual({});
    expect(service.getAllBundles()).toEqual({});
  });

  it('adds a new source and writes schema version 3.0', () => {
    service.addSource('official/anthropic/skills', {
      url: 'https://github.com/anthropics/skills',
      type: 'official',
      repoName: 'skills',
    });

    const source = service.getSource('official/anthropic/skills');
    expect(source).toBeDefined();
    expect(source!.url).toBe('https://github.com/anthropics/skills');

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.version).toBe('3.0');
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

  it('supports git bundle CRUD and preserves bundle installedAt', () => {
    const id = makeBundleId('git', 'https://github.com/openai/skills');

    service.addBundle(id, {
      type: 'git',
      url: 'https://github.com/openai/skills',
      selectionMode: 'all',
      members: ['community/openai/skills'],
    });

    const created = service.getBundle(id);
    expect(created).toBeDefined();
    expect(service.getAllBundles()[id]).toEqual(created);

    const installedAt = created!.installedAt;

    service.addBundle(id, {
      type: 'git',
      url: 'https://github.com/openai/skills',
      selectionMode: 'subset',
      members: ['community/openai/skills'],
    });

    const updated = service.getBundle(id)!;
    expect(updated.installedAt).toBe(installedAt);
    expect(updated.selectionMode).toBe('subset');

    service.updateBundleMembers(id, ['community/openai/skills', 'community/openai/extra']);
    expect(service.getBundle(id)!.members).toEqual([
      'community/openai/skills',
      'community/openai/extra',
    ]);

    service.updateBundleTimestamp(id);
    service.removeBundle(id);
    expect(service.getBundle(id)).toBeUndefined();
  });

  it('rejects local-batch bundle writes', () => {
    expect(() =>
      service.addBundle(makeBundleId('local-batch', '/tmp/spec-tdd'), {
        type: 'local-batch',
        url: '/tmp/spec-tdd',
        selectionMode: 'all',
        members: ['custom/spec-tdd/a'],
      }),
    ).toThrow('local-batch bundles must be stored as physical groups in groups.json');
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

  it('migrates V2 local-batch bundles into physical groups and writes backup', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        version: '2.0',
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
            url: 'https://github.com/acme/repo',
            type: 'community',
            repoName: 'repo-a',
            installMethod: 'git',
            installedAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        },
        bundles: {
          [makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd'))]: {
            type: 'local-batch',
            url: './fixtures/spec-tdd',
            selectionMode: 'all',
            members: ['custom/spec-tdd/a', 'custom/spec-tdd/b'],
            installedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:01.000Z',
          },
          [makeBundleId('git', 'https://github.com/acme/repo')]: {
            type: 'git',
            url: 'https://github.com/acme/repo',
            selectionMode: 'all',
            members: ['community/acme/repo-a'],
            installedAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        },
      }, null, 2),
    );

    const bundles = service.getAllBundles();
    const groups = new GroupsService();

    expect(bundles[makeBundleId('git', 'https://github.com/acme/repo')]).toMatchObject({
      type: 'git',
      members: ['community/acme/repo-a'],
    });
    expect(bundles[makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd'))]).toBeUndefined();
    expect(groups.getGroup('spec-tdd')).toEqual({
      kind: 'local-batch',
      url: normalizeLocalPath('./fixtures/spec-tdd'),
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:01.000Z',
    });

    const stored = JSON.parse(readFileSync(sourcesFile, 'utf-8'));
    expect(stored.version).toBe('3.0');
    expect(readFileSync(join(SKILLS_MANAGER_DIR, 'sources.json.v2.backup'), 'utf-8')).toContain(
      '"local-batch"',
    );
  });

  it('does not rewrite or back up an existing V3 file', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        version: '3.0',
        sources: {},
        bundles: {},
      }, null, 2),
    );

    expect(service.getAllSources()).toEqual({});
    expect(existsSync(join(SKILLS_MANAGER_DIR, 'sources.json.v2.backup'))).toBe(false);
  });

  it('uses temp file writes without corrupting the original file on failure', () => {
    writeFileSync(
      sourcesFile,
      JSON.stringify({
        version: '3.0',
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

  it('rebinds a physical group url and updates related source entries', () => {
    createPhysicalSkill('spec-tdd', 'a');
    createPhysicalSkill('spec-tdd', 'b');
    groupsService.createLocalBatchGroup('spec-tdd', normalizeLocalPath('./fixtures/spec-tdd'));

    service.addSource('custom/spec-tdd/a', {
      url: normalizeLocalPath('./fixtures/spec-tdd'),
      type: 'custom',
      repoName: 'a',
      installMethod: 'local-copy',
    });
    service.addSource('custom/spec-tdd/b', {
      url: normalizeLocalPath('./fixtures/spec-tdd'),
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

    const result = service.rebindLocalBundle(
      makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd')),
      normalizeLocalPath('./fixtures/spec-tdd-renamed'),
    );

    expect(result.newBundleId).toBe(
      makeBundleId('local-batch', normalizeLocalPath('./fixtures/spec-tdd-renamed')),
    );
    expect(groupsService.getGroup('spec-tdd')).toMatchObject({
      kind: 'local-batch',
      url: normalizeLocalPath('./fixtures/spec-tdd-renamed'),
    });
    expect(service.getSource('custom/spec-tdd/a')!.url).toBe(
      normalizeLocalPath('./fixtures/spec-tdd-renamed'),
    );
    expect(service.getSource('custom/spec-tdd/b')!.url).toBe(
      normalizeLocalPath('./fixtures/spec-tdd-renamed'),
    );
    expect(service.getSource('custom/other')!.url).toBe(
      normalizeLocalPath('./fixtures/other'),
    );
  });

  it('fails rebindLocalBundle when the physical group does not exist', () => {
    expect(() =>
      service.rebindLocalBundle(
        makeBundleId('local-batch', normalizeLocalPath('./fixtures/missing')),
        normalizeLocalPath('./fixtures/new'),
      ),
    ).toThrow('Local bundle not found');
  });

  it('finds physical group candidates by basename', () => {
    createPhysicalSkill('spec-tdd', 'alpha');
    createPhysicalSkill('spec-tdd', 'beta');
    groupsService.createLocalBatchGroup('spec-tdd', normalizeLocalPath('./fixtures/spec-tdd'));
    service.addSource('custom/spec-tdd/alpha', {
      url: normalizeLocalPath('./fixtures/spec-tdd'),
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });

    const candidates = service.findPhysicalGroupsByBasename('spec-tdd');

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: 'spec-tdd',
      group: {
        url: normalizeLocalPath('./fixtures/spec-tdd'),
        kind: 'local-batch',
      },
    });
  });
});

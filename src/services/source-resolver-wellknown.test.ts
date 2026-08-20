import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { SourceResolver } from './source-resolver.js';
import { SourceInfo, SourcesService } from './sources.js';

const STRIPE_KEY = 'well-known/docs.stripe.com';

function wellKnownSource(url: string, repoName: string): SourceInfo {
  return {
    url,
    type: 'well-known',
    repoName,
    installMethod: 'well-known',
    skillDigests: { alpha: `sha256:${'a'.repeat(64)}` },
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createResolver(sources: Record<string, SourceInfo>): SourceResolver {
  return new SourceResolver(
    {
      getAllSources: () => sources,
      findBundleByUrl: () => undefined,
      findPhysicalGroupsByBasename: () => [],
    } as never,
    { getAllSkills: () => [] } as never,
    { parseGitHubUrl: () => null } as never,
    { getGroup: () => null, getGroupMembers: () => [], listGroups: () => [] } as never,
  );
}

describe('SourceResolver well-known URLs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves an installed site URL to its source key for uninstall', async () => {
    const resolver = createResolver({
      [STRIPE_KEY]: wellKnownSource('https://docs.stripe.com', 'docs.stripe.com'),
    });

    await expect(resolver.resolve('https://docs.stripe.com')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: [STRIPE_KEY],
    });
  });

  it('resolves the same site URL for remove', async () => {
    const resolver = createResolver({
      [STRIPE_KEY]: wellKnownSource('https://docs.stripe.com', 'docs.stripe.com'),
    });

    const target = await resolver.resolve('https://docs.stripe.com');

    expect(target.kind).toBe('source');
    expect(target.sourceKeys).toEqual([STRIPE_KEY]);
    expect(target.originalInput).toBe('https://docs.stripe.com');
  });

  it('matches despite a trailing slash', async () => {
    const resolver = createResolver({
      [STRIPE_KEY]: wellKnownSource('https://docs.stripe.com', 'docs.stripe.com'),
    });

    await expect(resolver.resolve('https://docs.stripe.com/')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: [STRIPE_KEY],
    });
  });

  it('reports not-found for an uninstalled site without any network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const resolver = createResolver({
      [STRIPE_KEY]: wellKnownSource('https://docs.stripe.com', 'docs.stripe.com'),
    });

    const target = await resolver.resolve('https://example.com');

    expect(target.kind).toBe('not-found');
    expect(target.reason).toContain('well-known');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches a bare hostname through the installed source key suffix', async () => {
    const resolver = createResolver({
      [STRIPE_KEY]: wellKnownSource('https://docs.stripe.com', 'docs.stripe.com'),
    });

    await expect(resolver.resolve('docs.stripe.com')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: [STRIPE_KEY],
    });
  });

  it('does not hijack an installed git source that shares the host', async () => {
    const resolver = createResolver({
      'community/team/skills': {
        url: 'https://git.company.com/team/skills',
        type: 'community',
        repoName: 'skills',
        installMethod: 'git',
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await expect(resolver.resolve('https://git.company.com/team/skills'))
      .resolves.toMatchObject({
        kind: 'source',
        sourceKeys: ['community/team/skills'],
      });
  });
});

describe('well-known source removal bookkeeping', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-resolver-wellknown-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('drops only the well-known entry when its source is uninstalled', () => {
    const service = new SourcesService();
    service.addSource(STRIPE_KEY, {
      url: 'https://docs.stripe.com',
      type: 'well-known',
      repoName: 'docs.stripe.com',
      installMethod: 'well-known',
      skillDigests: { alpha: `sha256:${'a'.repeat(64)}` },
    });
    service.addSource('community/owner/repo', {
      url: 'https://github.com/owner/repo',
      type: 'community',
      repoName: 'repo',
      installMethod: 'git',
    });
    const otherBefore = service.getSource('community/owner/repo');

    service.removeSource(STRIPE_KEY);

    expect(service.getSource(STRIPE_KEY)).toBeUndefined();
    expect(service.getSource('community/owner/repo')).toEqual(otherBefore);
    expect(Object.keys(service.getAllSources())).toEqual(['community/owner/repo']);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { discoverIndex } from './discovery.js';
import { DISCOVERY_SCHEMA_V2 } from './index-schema.js';

const PREFERRED = 'https://example.com/.well-known/agent-skills/index.json';
const LEGACY = 'https://example.com/.well-known/skills/index.json';

const V1_INDEX = {
  skills: [{ name: 'alpha', description: 'Alpha skill', files: ['SKILL.md'] }],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function notFound(): Response {
  return new Response('nope', { status: 404 });
}

function routedFetch(routes: Record<string, () => Promise<Response> | Response>) {
  return vi.fn(async (url: string) => {
    const handler = routes[url];
    if (!handler) {
      return notFound();
    }
    return handler();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('discoverIndex', () => {
  it('uses the preferred path and stops probing once it hits', async () => {
    const fetchMock = routedFetch({ [PREFERRED]: () => jsonResponse(V1_INDEX) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.indexUrl).toBe(PREFERRED);
    expect(result.hit.wellKnownPath).toBe('.well-known/agent-skills');
    expect(result.hit.version).toBe('0.1.0');
    expect(result.hit.entries.map((e) => e.name)).toEqual(['alpha']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain(LEGACY);
  });

  it('falls back to the legacy path', async () => {
    const fetchMock = routedFetch({ [LEGACY]: () => jsonResponse(V1_INDEX) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.indexUrl).toBe(LEGACY);
    expect(result.hit.wellKnownPath).toBe('.well-known/skills');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([PREFERRED, LEGACY]);
  });

  it('probes the origin root even when the input carries a path', async () => {
    const fetchMock = routedFetch({ [PREFERRED]: () => jsonResponse(V1_INDEX) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com/docs/guide');

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(PREFERRED);
    expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain(
      'https://example.com/docs/guide/.well-known/agent-skills/index.json',
    );
  });

  it('treats a timed-out probe as a miss and continues', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchMock = routedFetch({
      [PREFERRED]: () => Promise.reject(abort),
      [LEGACY]: () => jsonResponse(V1_INDEX),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.indexUrl).toBe(LEGACY);
  });

  it('reports failure with every probed URL when nothing is served', async () => {
    const fetchMock = routedFetch({});
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.probedUrls).toEqual([PREFERRED, LEGACY]);
    expect(result.failure.discarded).toEqual([]);
  });

  it('treats an unknown $schema as a miss', async () => {
    const fetchMock = routedFetch({
      [PREFERRED]: () =>
        jsonResponse({ $schema: 'https://example.com/other.json', skills: [] }),
      [LEGACY]: () => jsonResponse(V1_INDEX),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.indexUrl).toBe(LEGACY);
  });

  it('treats malformed JSON as a miss', async () => {
    const fetchMock = routedFetch({
      [PREFERRED]: () => new Response('{ not json', { status: 200 }),
      [LEGACY]: () => jsonResponse(V1_INDEX),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.indexUrl).toBe(LEGACY);
  });

  it('fails with discard reasons when an index has zero valid entries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = routedFetch({
      [PREFERRED]: () =>
        jsonResponse({ skills: [{ name: 'BAD', description: 'x', files: ['SKILL.md'] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.discarded).toHaveLength(1);
    expect(result.failure.discarded[0].name).toBe('BAD');
  });

  it('accepts a v0.2.0 index', async () => {
    const fetchMock = routedFetch({
      [PREFERRED]: () =>
        jsonResponse({
          $schema: DISCOVERY_SCHEMA_V2,
          skills: [
            {
              name: 'alpha',
              type: 'archive',
              description: 'Alpha skill',
              url: '/artifacts/alpha.tar.gz',
              digest: `sha256:${'b'.repeat(64)}`,
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverIndex('https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hit.version).toBe('0.2.0');
  });

  it('refuses a non-loopback http input before probing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(discoverIndex('http://example.com')).rejects.toThrow(/https/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

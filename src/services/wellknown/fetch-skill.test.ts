import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { fetchSkill } from './fetch-skill.js';
import { computeArtifactDigest } from './digest.js';
import type { WellKnownEntry } from './index-schema.js';

const ORIGIN = 'https://example.com';
const WELL_KNOWN_PATH = '.well-known/agent-skills';

const tempDirs: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'smgr-wk-fetch-'));
  tempDirs.push(dir);
  return dir;
}

function routedFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string) => {
    const handler = routes[url];
    return handler ? handler() : new Response('nope', { status: 404 });
  });
}

function tarHeader(path: string, size: number): Buffer {
  const header = Buffer.alloc(512);
  header.write(path, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'utf8');
  header.write('0000000\0', 108, 8, 'utf8');
  header.write('0000000\0', 116, 8, 'utf8');
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'utf8');
  header.write('00000000000\0', 136, 12, 'utf8');
  header.write('        ', 148, 8, 'utf8');
  header.write('0', 156, 1, 'utf8');
  header.write('ustar\0', 257, 6, 'utf8');
  header.write('00', 263, 2, 'utf8');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'utf8');
  return header;
}

function buildTarGz(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    blocks.push(tarHeader(entry.path, entry.content.length));
    blocks.push(entry.content);
    const padding = (512 - (entry.content.length % 512)) % 512;
    if (padding > 0) blocks.push(Buffer.alloc(padding));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

const v1Entry: WellKnownEntry = {
  version: '0.1.0',
  name: 'alpha',
  description: 'Alpha skill',
  files: ['SKILL.md', 'references/a.md'],
};

afterEach(() => {
  vi.unstubAllGlobals();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('fetchSkill v0.1.0', () => {
  it('writes every listed file and returns a computed digest', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/${WELL_KNOWN_PATH}/alpha/SKILL.md`]: () => new Response('# alpha'),
        [`${ORIGIN}/${WELL_KNOWN_PATH}/alpha/references/a.md`]: () => new Response('ref'),
      }),
    );

    const result = await fetchSkill(v1Entry, {
      origin: ORIGIN,
      wellKnownPath: WELL_KNOWN_PATH,
      destDir,
    });

    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('# alpha');
    expect(readFileSync(join(destDir, 'references/a.md'), 'utf8')).toBe('ref');
    expect(result.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('fetches files serially in listed order', async () => {
    const root = makeRoot();
    const fetchMock = routedFetch({
      [`${ORIGIN}/${WELL_KNOWN_PATH}/alpha/SKILL.md`]: () => new Response('# alpha'),
      [`${ORIGIN}/${WELL_KNOWN_PATH}/alpha/references/a.md`]: () => new Response('ref'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchSkill(v1Entry, {
      origin: ORIGIN,
      wellKnownPath: WELL_KNOWN_PATH,
      destDir: join(root, 'alpha'),
    });

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${ORIGIN}/${WELL_KNOWN_PATH}/alpha/SKILL.md`,
      `${ORIGIN}/${WELL_KNOWN_PATH}/alpha/references/a.md`,
    ]);
  });

  it('fails the whole skill and leaves no directory when one file 404s', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/${WELL_KNOWN_PATH}/alpha/SKILL.md`]: () => new Response('# alpha'),
      }),
    );

    await expect(
      fetchSkill(v1Entry, { origin: ORIGIN, wellKnownPath: WELL_KNOWN_PATH, destDir }),
    ).rejects.toThrow(/references\/a\.md/);

    expect(existsSync(destDir)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });
});

describe('fetchSkill v0.2.0', () => {
  const artifact = Buffer.from('# alpha from artifact');

  function skillMdEntry(digest: string): WellKnownEntry {
    return {
      version: '0.2.0',
      name: 'alpha',
      description: 'Alpha skill',
      type: 'skill-md',
      artifactUrl: `${ORIGIN}/artifacts/alpha.md`,
      digest,
    };
  }

  it('writes SKILL.md and adopts the index digest when it matches', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    const digest = computeArtifactDigest(artifact);
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/artifacts/alpha.md`]: () => new Response(new Uint8Array(artifact)),
      }),
    );

    const result = await fetchSkill(skillMdEntry(digest), {
      origin: ORIGIN,
      wellKnownPath: WELL_KNOWN_PATH,
      destDir,
    });

    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe(artifact.toString());
    expect(result.digest).toBe(digest);
  });

  it('fails closed and cleans up when the digest does not match', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/artifacts/alpha.md`]: () => new Response(new Uint8Array(artifact)),
      }),
    );

    await expect(
      fetchSkill(skillMdEntry(`sha256:${'0'.repeat(64)}`), {
        origin: ORIGIN,
        wellKnownPath: WELL_KNOWN_PATH,
        destDir,
      }),
    ).rejects.toThrow(/digest/i);

    expect(existsSync(destDir)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });

  it('unpacks an archive artifact', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    const archive = buildTarGz([
      { path: 'SKILL.md', content: Buffer.from('# packed') },
      { path: 'references/a.md', content: Buffer.from('ref') },
    ]);
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/artifacts/alpha.tgz`]: () => new Response(new Uint8Array(archive)),
      }),
    );

    const result = await fetchSkill(
      {
        version: '0.2.0',
        name: 'alpha',
        description: 'Alpha skill',
        type: 'archive',
        artifactUrl: `${ORIGIN}/artifacts/alpha.tgz`,
        digest: computeArtifactDigest(archive),
      },
      { origin: ORIGIN, wellKnownPath: WELL_KNOWN_PATH, destDir },
    );

    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('# packed');
    expect(readFileSync(join(destDir, 'references/a.md'), 'utf8')).toBe('ref');
    expect(result.digest).toBe(computeArtifactDigest(archive));
  });

  it('cleans up when the archive contains an escaping path', async () => {
    const root = makeRoot();
    const destDir = join(root, 'alpha');
    const archive = buildTarGz([{ path: '../escaped.md', content: Buffer.from('bad') }]);
    vi.stubGlobal(
      'fetch',
      routedFetch({
        [`${ORIGIN}/artifacts/alpha.tgz`]: () => new Response(new Uint8Array(archive)),
      }),
    );

    await expect(
      fetchSkill(
        {
          version: '0.2.0',
          name: 'alpha',
          description: 'Alpha skill',
          type: 'archive',
          artifactUrl: `${ORIGIN}/artifacts/alpha.tgz`,
          digest: computeArtifactDigest(archive),
        },
        { origin: ORIGIN, wellKnownPath: WELL_KNOWN_PATH, destDir },
      ),
    ).rejects.toThrow(/unsafe archive path/i);

    expect(existsSync(destDir)).toBe(false);
    expect(readdirSync(root)).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { Readable } from 'stream';
import * as tar from 'tar';
import {
  ArchiveAuthError,
  buildArchiveUrl,
  downloadAndExtractArchive,
  extractCommitSha,
  isAuthFailureStatus,
} from './github-archive.js';

const SHA = 'a'.repeat(40);
const FINAL_URL = `https://codeload.github.com/obra/superpowers/tar.gz/${SHA}`;

function tarToBuffer(cwd: string, paths: string[]): Buffer {
  const stageDir = mkdtempSync(join(tmpdir(), 'smgr-tarout-'));
  const out = join(stageDir, 'a.tar');
  try {
    tar.create({ sync: true, file: out, cwd, preservePaths: true }, paths);
    return readFileSync(out);
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

function makeTarGz(
  entries: Array<{ path: string; content: string }>,
  wrapDir = 'repo-main',
): Buffer {
  const stageDir = mkdtempSync(join(tmpdir(), 'smgr-targz-'));
  try {
    for (const entry of entries) {
      const full = join(stageDir, wrapDir, entry.path);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, entry.content);
    }
    return gzipSync(tarToBuffer(stageDir, [wrapDir]));
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

function mockResponse(body: Buffer, init?: { status?: number; url?: string }): Response {
  const stream = Readable.toWeb(Readable.from(body)) as ReadableStream<Uint8Array>;
  const status = init?.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: init?.url ?? FINAL_URL,
    body: stream,
  } as unknown as Response;
}

describe('buildArchiveUrl', () => {
  it('builds the github archive tar.gz url with a ref', () => {
    expect(buildArchiveUrl('obra', 'superpowers', 'v1.2.3')).toBe(
      'https://github.com/obra/superpowers/archive/v1.2.3.tar.gz',
    );
  });

  it('defaults ref to HEAD when omitted or empty', () => {
    expect(buildArchiveUrl('obra', 'superpowers')).toBe(
      'https://github.com/obra/superpowers/archive/HEAD.tar.gz',
    );
    expect(buildArchiveUrl('obra', 'superpowers', '')).toBe(
      'https://github.com/obra/superpowers/archive/HEAD.tar.gz',
    );
  });

  it('url-encodes owner/repo/ref', () => {
    expect(buildArchiveUrl('o w', 'r/p', 'feat/x')).toBe(
      'https://github.com/o%20w/r%2Fp/archive/feat%2Fx.tar.gz',
    );
  });
});

describe('extractCommitSha', () => {
  it('extracts the 40-hex sha from a codeload url', () => {
    expect(extractCommitSha(FINAL_URL)).toBe(SHA);
  });

  it('returns null when the url has no embedded sha', () => {
    expect(
      extractCommitSha('https://codeload.github.com/obra/superpowers/tar.gz/main'),
    ).toBeNull();
    expect(extractCommitSha('https://example.com/x')).toBeNull();
  });
});

describe('isAuthFailureStatus', () => {
  it('treats 401/403/404 as auth failures', () => {
    expect(isAuthFailureStatus(401)).toBe(true);
    expect(isAuthFailureStatus(403)).toBe(true);
    expect(isAuthFailureStatus(404)).toBe(true);
    expect(isAuthFailureStatus(200)).toBe(false);
    expect(isAuthFailureStatus(500)).toBe(false);
  });
});

describe('downloadAndExtractArchive', () => {
  let destDir: string;
  const fetchMock = vi.fn();

  beforeEach(() => {
    destDir = mkdtempSync(join(tmpdir(), 'smgr-extract-'));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    rmSync(destDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('downloads, strips the wrapper dir, and returns the commit sha', async () => {
    const body = makeTarGz([
      { path: 'SKILL.md', content: '---\nname: a\n---\n' },
      { path: 'deep/nested/file.txt', content: 'hello' },
    ]);
    fetchMock.mockResolvedValue(mockResponse(body));

    const result = await downloadAndExtractArchive(
      buildArchiveUrl('obra', 'superpowers'),
      destDir,
    );

    expect(result.commitSha).toBe(SHA);
    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toContain('name: a');
    expect(readFileSync(join(destDir, 'deep/nested/file.txt'), 'utf8')).toBe('hello');
  });

  it('throws ArchiveAuthError on 403', async () => {
    fetchMock.mockResolvedValue(mockResponse(Buffer.alloc(0), { status: 403 }));
    await expect(
      downloadAndExtractArchive(buildArchiveUrl('o', 'r'), destDir),
    ).rejects.toBeInstanceOf(ArchiveAuthError);
  });

  it('rejects non-https urls', async () => {
    await expect(
      downloadAndExtractArchive('http://github.com/o/r/archive/HEAD.tar.gz', destDir),
    ).rejects.toThrow(/non-https/);
  });

  it('rejects redirect to a non-codeload host (SSRF guard)', async () => {
    const body = makeTarGz([{ path: 'SKILL.md', content: 'x' }]);
    fetchMock.mockResolvedValue(
      mockResponse(body, { url: 'https://evil.example.com/x.tar.gz' }),
    );
    await expect(
      downloadAndExtractArchive(buildArchiveUrl('o', 'r'), destDir),
    ).rejects.toThrow(/SSRF/);
  });

  it('fails closed when the final url has no commit sha', async () => {
    const body = makeTarGz([{ path: 'SKILL.md', content: 'x' }]);
    fetchMock.mockResolvedValue(
      mockResponse(body, {
        url: 'https://codeload.github.com/o/r/tar.gz/refs/heads/main',
      }),
    );
    await expect(
      downloadAndExtractArchive(buildArchiveUrl('o', 'r'), destDir),
    ).rejects.toThrow(/commit sha/);
  });

  it('allows a missing sha when requireSha is false (branch ref)', async () => {
    const body = makeTarGz([{ path: 'SKILL.md', content: 'x' }]);
    fetchMock.mockResolvedValue(
      mockResponse(body, {
        url: 'https://codeload.github.com/o/r/tar.gz/refs/heads/main',
      }),
    );
    const result = await downloadAndExtractArchive(
      buildArchiveUrl('o', 'r', 'main'),
      destDir,
      { requireSha: false },
    );
    expect(result.commitSha).toBeUndefined();
    expect(readFileSync(join(destDir, 'SKILL.md'), 'utf8')).toBe('x');
  });

  it('does not write outside dest for path-traversal entries', async () => {
    // Stage a layout whose tar contains an entry that tries to escape via `..`.
    const stageDir = mkdtempSync(join(tmpdir(), 'smgr-evil-'));
    try {
      mkdirSync(join(stageDir, 'wrap'), { recursive: true });
      writeFileSync(join(stageDir, 'wrap', 'ok.txt'), 'ok');
      writeFileSync(join(stageDir, 'evil.txt'), 'evil');
      // 'wrap/../evil.txt' contains a `..` segment; node-tar drops such entries
      // by default, so it must never land at destDir/.. (the escape target).
      const body = gzipSync(
        tarToBuffer(stageDir, ['wrap/ok.txt', 'wrap/../evil.txt']),
      );
      fetchMock.mockResolvedValue(mockResponse(body));

      await downloadAndExtractArchive(
        buildArchiveUrl('o', 'r'),
        destDir,
      ).catch(() => undefined);

      // The escape target (one level above destDir) must not have been written.
      expect(existsSync(join(destDir, '..', 'evil.txt'))).toBe(false);
    } finally {
      rmSync(stageDir, { recursive: true, force: true });
    }
  });

  it('aborts on decompression-bomb (uncompressed size cap)', async () => {
    // A highly compressible 1GB payload gzips to a few MB but blows the
    // uncompressed cap (800MB) during extraction.
    const big = Buffer.alloc(1024 * 1024 * 1024, 0x61); // 1 GiB of 'a'
    const stageDir = mkdtempSync(join(tmpdir(), 'smgr-bomb-'));
    try {
      mkdirSync(join(stageDir, 'wrap'), { recursive: true });
      writeFileSync(join(stageDir, 'wrap', 'big.txt'), big);
      const body = gzipSync(tarToBuffer(stageDir, ['wrap']));
      fetchMock.mockResolvedValue(mockResponse(body));

      await expect(
        downloadAndExtractArchive(buildArchiveUrl('o', 'r'), destDir),
      ).rejects.toThrow(/uncompressed archive exceeded/);
    } finally {
      rmSync(stageDir, { recursive: true, force: true });
    }
  }, 30_000);
});

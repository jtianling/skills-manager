import { execFileSync } from 'child_process';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import * as tar from 'tar';

const CONNECT_TIMEOUT_MS = 30_000;
const CHUNK_IDLE_TIMEOUT_MS = 30_000;
const MAX_COMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 800 * 1024 * 1024;

const CODELOAD_PREFIX = 'https://codeload.github.com/';
const SHA_FROM_URL = /codeload\.github\.com\/.+\/tar\.gz\/([0-9a-f]{40})/;

export interface ArchiveDownloadResult {
  commitSha?: string;
}

export interface ArchiveDownloadOptions {
  /**
   * When true (default), a missing 40-hex sha in the redirect URL is fatal
   * (fail-closed). Named branch refs resolve to `tar.gz/refs/heads/<branch>`
   * with no sha; callers requesting an explicit branch pass false and accept
   * an empty version.
   */
  requireSha?: boolean;
}

/**
 * Build the GitHub codeload archive URL. owner/repo/ref are URL-encoded; ref
 * defaults to HEAD when not provided.
 */
export function buildArchiveUrl(owner: string, repo: string, ref?: string): string {
  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);
  const safeRef = encodeURIComponent(ref && ref.length > 0 ? ref : 'HEAD');
  return `https://github.com/${safeOwner}/${safeRepo}/archive/${safeRef}.tar.gz`;
}

/**
 * Extract the 40-hex commit sha from the followed-redirect codeload URL.
 * Returns null when the URL does not embed a sha (caller fails closed).
 */
export function extractCommitSha(finalUrl: string): string | null {
  const match = finalUrl.match(SHA_FROM_URL);
  return match ? match[1] : null;
}

/** HTTP status codes that indicate a private / inaccessible repo. */
export function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

export class ArchiveAuthError extends Error {
  constructor(public readonly status: number) {
    super(`codeload archive request failed with status ${status}`);
    this.name = 'ArchiveAuthError';
  }
}

function assertHttps(url: string): void {
  if (!url.startsWith('https://')) {
    throw new Error(`Refusing non-https archive URL: ${url}`);
  }
}

function assertCodeloadHost(finalUrl: string): void {
  if (!finalUrl.startsWith(CODELOAD_PREFIX)) {
    throw new Error(
      `Archive redirected to unexpected host (SSRF guard): ${finalUrl}`,
    );
  }
}

function countingTransform(limit: number, label: string): Transform {
  let total = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, done) {
      total += chunk.length;
      if (total > limit) {
        done(new Error(`${label} exceeded limit of ${limit} bytes`));
        return;
      }
      done(null, chunk);
    },
  });
}

async function fetchArchive(url: string): Promise<Response> {
  assertHttps(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  timer.unref();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function idleTimeoutBody(body: ReadableStream<Uint8Array>): Readable {
  const node = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  let timer: NodeJS.Timeout | undefined;
  const arm = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      node.destroy(new Error('archive body idle timeout (slowloris guard)'));
    }, CHUNK_IDLE_TIMEOUT_MS);
    timer.unref();
  };
  node.on('data', arm);
  node.on('end', () => clearTimeout(timer));
  node.on('error', () => clearTimeout(timer));
  arm();
  return node;
}

/**
 * Download a GitHub codeload archive, verify the redirect target, enforce
 * size caps, then gunzip + untar into destDir (strip top-level wrapper).
 * Returns the captured commit sha. Throws ArchiveAuthError on 401/403/404.
 */
export async function downloadAndExtractArchive(
  url: string,
  destDir: string,
  options: ArchiveDownloadOptions = {},
): Promise<ArchiveDownloadResult> {
  const requireSha = options.requireSha ?? true;
  const response = await fetchArchive(url);

  if (isAuthFailureStatus(response.status)) {
    throw new ArchiveAuthError(response.status);
  }
  if (!response.ok) {
    throw new Error(
      `codeload archive request failed: ${response.status} ${response.statusText}`,
    );
  }

  const finalUrl = response.url;
  assertCodeloadHost(finalUrl);

  const commitSha = extractCommitSha(finalUrl) ?? undefined;
  if (!commitSha && requireSha) {
    throw new Error(
      `Could not extract commit sha from archive URL (fail-closed): ${finalUrl}`,
    );
  }

  if (!response.body) {
    throw new Error('codeload archive response has no body');
  }

  const source = idleTimeoutBody(response.body);
  await pipeline(
    source,
    countingTransform(MAX_COMPRESSED_BYTES, 'compressed archive'),
    createGunzip(),
    countingTransform(MAX_UNCOMPRESSED_BYTES, 'uncompressed archive'),
    tar.extract({ cwd: destDir, strip: 1, preservePaths: false }),
  );

  return { commitSha };
}

/** Detect git availability without crashing on missing binary. */
export function isGitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

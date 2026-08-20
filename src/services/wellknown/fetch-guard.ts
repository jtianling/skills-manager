import { Readable } from 'stream';

export const DISCOVERY_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface GuardedFetchOptions {
  timeoutMs?: number;
}

/**
 * Enforce https-only transport. http is tolerated for loopback hosts only,
 * which is what makes local fixture servers usable.
 */
export function assertTransportAllowed(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid well-known URL: ${rawUrl}`);
  }

  if (url.protocol === 'https:') {
    return url;
  }

  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    return url;
  }

  throw new Error(
    `Refusing non-https well-known URL: ${rawUrl} ` +
    '(http is allowed for loopback hosts only)',
  );
}

/**
 * Fetch with manual redirect handling so a redirect off the original host is
 * refused before any response body is touched.
 */
export async function guardedFetch(
  rawUrl: string,
  options: GuardedFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
  const origin = assertTransportAllowed(rawUrl);
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchWithTimeout(currentUrl, timeoutMs);
    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      return response;
    }

    const next = assertTransportAllowed(new URL(location, currentUrl).toString());
    if (next.host !== origin.host) {
      throw new Error(
        `Refusing well-known redirect to another host: ${origin.host} -> ${next.host}`,
      );
    }
    currentUrl = next.toString();
  }

  throw new Error(`Too many redirects while fetching ${rawUrl}`);
}

/** Read a response body into memory under a byte cap with an idle timeout. */
export async function readBodyBuffer(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  if (!response.body) {
    return Buffer.alloc(0);
  }

  const stream = idleTimeoutStream(response.body);
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > maxBytes) {
      stream.destroy();
      throw new Error(`Download exceeded limit of ${maxBytes} bytes`);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303
    || status === 307 || status === 308;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    return await fetch(url, { redirect: 'manual', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function idleTimeoutStream(body: ReadableStream<Uint8Array>): Readable {
  const node = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  let timer: NodeJS.Timeout | undefined;

  const arm = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      node.destroy(new Error('well-known download idle timeout'));
    }, IDLE_TIMEOUT_MS);
    timer.unref?.();
  };

  node.on('data', arm);
  node.on('end', () => clearTimeout(timer));
  node.on('error', () => clearTimeout(timer));
  arm();
  return node;
}

import { WELL_KNOWN_PATHS } from '../../constants.js';
import {
  assertTransportAllowed,
  DISCOVERY_TIMEOUT_MS,
  guardedFetch,
  readBodyBuffer,
} from './fetch-guard.js';
import {
  validateIndex,
  type DiscardedEntry,
  type WellKnownEntry,
} from './index-schema.js';

const MAX_INDEX_BYTES = 5 * 1024 * 1024;

export interface DiscoveryHit {
  origin: string;
  wellKnownPath: string;
  indexUrl: string;
  version: '0.1.0' | '0.2.0';
  entries: WellKnownEntry[];
  discarded: DiscardedEntry[];
}

export interface DiscoveryFailure {
  origin: string;
  probedUrls: string[];
  discarded: DiscardedEntry[];
}

export type DiscoveryResult =
  | { ok: true; hit: DiscoveryHit }
  | { ok: false; failure: DiscoveryFailure };

export function buildIndexUrl(origin: string, wellKnownPath: string): string {
  return `${origin}/${wellKnownPath}/index.json`;
}

async function probe(indexUrl: string): Promise<unknown | null> {
  try {
    const response = await guardedFetch(indexUrl, { timeoutMs: DISCOVERY_TIMEOUT_MS });
    if (!response.ok) {
      return null;
    }
    const body = await readBodyBuffer(response, MAX_INDEX_BYTES);
    return JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Probe the origin root for a well-known skills index. The input URL's path is
 * ignored: RFC 8615 anchors well-known URIs at the origin.
 */
export async function discoverIndex(input: string): Promise<DiscoveryResult> {
  const origin = assertTransportAllowed(input).origin;
  const probedUrls: string[] = [];
  const discarded: DiscardedEntry[] = [];

  for (const wellKnownPath of WELL_KNOWN_PATHS) {
    const indexUrl = buildIndexUrl(origin, wellKnownPath);
    probedUrls.push(indexUrl);

    const raw = await probe(indexUrl);
    if (raw === null) {
      continue;
    }

    const validated = validateIndex(raw, indexUrl);
    if (!validated) {
      continue;
    }

    discarded.push(...validated.discarded);
    reportDiscarded(indexUrl, validated.discarded);

    if (validated.entries.length === 0) {
      continue;
    }

    return {
      ok: true,
      hit: {
        origin,
        wellKnownPath,
        indexUrl,
        version: validated.version,
        entries: validated.entries,
        discarded: validated.discarded,
      },
    };
  }

  return { ok: false, failure: { origin, probedUrls, discarded } };
}

function reportDiscarded(indexUrl: string, discarded: DiscardedEntry[]): void {
  for (const entry of discarded) {
    console.error(`  ⚠ ${indexUrl}: skipped "${entry.name}" — ${entry.reason}`);
  }
}

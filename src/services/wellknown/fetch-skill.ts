import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { extractArchive, MAX_ARCHIVE_UNPACKED_BYTES } from './archive.js';
import { computeArtifactDigest, computeSkillDigest } from './digest.js';
import { guardedFetch, readBodyBuffer } from './fetch-guard.js';
import type { WellKnownEntry } from './index-schema.js';

export interface FetchSkillContext {
  origin: string;
  wellKnownPath: string;
  destDir: string;
}

export interface FetchSkillResult {
  digest: string;
}

async function download(url: string): Promise<Buffer> {
  const response = await guardedFetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return readBodyBuffer(response, MAX_ARCHIVE_UNPACKED_BYTES);
}

async function fetchV1Files(
  entry: Extract<WellKnownEntry, { version: '0.1.0' }>,
  context: FetchSkillContext,
): Promise<string> {
  const base = `${context.origin}/${context.wellKnownPath}/${entry.name}`;
  const contents = new Map<string, Buffer>();

  for (const file of entry.files) {
    const content = await download(`${base}/${file}`);
    const target = join(context.destDir, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    contents.set(file, content);
  }

  return computeSkillDigest(contents);
}

async function fetchV2Artifact(
  entry: Extract<WellKnownEntry, { version: '0.2.0' }>,
  context: FetchSkillContext,
): Promise<string> {
  const content = await download(entry.artifactUrl);
  const actual = computeArtifactDigest(content);

  if (actual !== entry.digest) {
    throw new Error(
      `Digest mismatch for "${entry.name}": expected ${entry.digest}, got ${actual}`,
    );
  }

  mkdirSync(context.destDir, { recursive: true });
  if (entry.type === 'skill-md') {
    writeFileSync(join(context.destDir, 'SKILL.md'), content);
  } else {
    await extractArchive(content, context.destDir);
  }

  return entry.digest;
}

/**
 * Download one skill into destDir. Any failure removes the partially written
 * directory so a broken skill never survives on disk.
 */
export async function fetchSkill(
  entry: WellKnownEntry,
  context: FetchSkillContext,
): Promise<FetchSkillResult> {
  try {
    const digest = entry.version === '0.1.0'
      ? await fetchV1Files(entry, context)
      : await fetchV2Artifact(entry, context);
    return { digest };
  } catch (error) {
    rmSync(context.destDir, { recursive: true, force: true });
    throw error;
  }
}

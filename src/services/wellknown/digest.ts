import { createHash } from 'crypto';

/**
 * Digest of a v0.1.0 skill's fetched files. Change detection only: the
 * publisher does not sign it, so it carries no tamper-evidence. Real
 * integrity checking exists on the v0.2.0 path, where the index ships a
 * digest of its own.
 */
export function computeSkillDigest(files: Map<string, Buffer>): string {
  const hash = createHash('sha256');

  for (const path of Array.from(files.keys()).sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(files.get(path)!);
    hash.update('\0');
  }

  return `sha256:${hash.digest('hex')}`;
}

/** Digest of a single downloaded artifact, matching the v0.2.0 index format. */
export function computeArtifactDigest(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

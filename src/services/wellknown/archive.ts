import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import * as tar from 'tar';

export const MAX_ARCHIVE_UNPACKED_BYTES = 50 * 1024 * 1024;
export const MAX_ARCHIVE_FILES = 1000;

const GZIP_MAGIC = [0x1f, 0x8b];

function isGzip(buffer: Buffer): boolean {
  return buffer[0] === GZIP_MAGIC[0] && buffer[1] === GZIP_MAGIC[1];
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

function isUnsafeEntryPath(path: string): boolean {
  if (!path || path.includes('\0')) return true;
  if (path.startsWith('/') || path.startsWith('\\')) return true;
  if (/^[A-Za-z]:/.test(path)) return true;
  return path.split(/[/\\]/).some((part) => part === '..');
}

/**
 * List the archive without writing anything, so unsafe paths and count caps
 * are refused before a single byte lands on disk.
 */
async function inspectArchive(buffer: Buffer): Promise<void> {
  const unsafePaths: string[] = [];
  let fileCount = 0;

  await pipeline(
    Readable.from(buffer),
    createGunzip(),
    countingTransform(MAX_ARCHIVE_UNPACKED_BYTES, 'uncompressed archive'),
    tar.list({
      onReadEntry: (entry) => {
        fileCount++;
        if (isUnsafeEntryPath(String(entry.path))) {
          unsafePaths.push(String(entry.path));
        }
      },
    }),
  );

  if (unsafePaths.length > 0) {
    throw new Error(`Unsafe archive path: ${unsafePaths[0]}`);
  }
  if (fileCount > MAX_ARCHIVE_FILES) {
    throw new Error(`Archive contains too many files (limit ${MAX_ARCHIVE_FILES})`);
  }
}

/** Unpack a gzipped tar artifact into destDir under fail-closed limits. */
export async function extractArchive(buffer: Buffer, destDir: string): Promise<void> {
  if (!isGzip(buffer)) {
    throw new Error(
      'Unsupported archive format: well-known artifacts must be gzipped tar',
    );
  }

  await inspectArchive(buffer);

  await pipeline(
    Readable.from(buffer),
    createGunzip(),
    countingTransform(MAX_ARCHIVE_UNPACKED_BYTES, 'uncompressed archive'),
    tar.extract({ cwd: destDir, preservePaths: false }),
  );
}

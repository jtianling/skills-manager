import { describe, it, expect, afterEach } from 'vitest';
import { gzipSync } from 'zlib';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { extractArchive } from './archive.js';

interface TarEntry {
  path: string;
  content: Buffer;
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

function buildTarGz(entries: TarEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    blocks.push(tarHeader(entry.path, entry.content.length));
    blocks.push(entry.content);
    const padding = (512 - (entry.content.length % 512)) % 512;
    if (padding > 0) {
      blocks.push(Buffer.alloc(padding));
    }
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

const tempDirs: string[] = [];

function makeDestDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'smgr-wk-archive-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('extractArchive', () => {
  it('extracts a well-formed tar.gz', async () => {
    const dest = makeDestDir();
    const archive = buildTarGz([
      { path: 'SKILL.md', content: Buffer.from('# hello') },
      { path: 'references/a.md', content: Buffer.from('ref') },
    ]);

    await extractArchive(archive, dest);

    expect(readFileSync(join(dest, 'SKILL.md'), 'utf8')).toBe('# hello');
    expect(readFileSync(join(dest, 'references/a.md'), 'utf8')).toBe('ref');
  });

  it('rejects an unsupported archive format', async () => {
    const dest = makeDestDir();

    await expect(extractArchive(Buffer.from('PK\x03\x04zip'), dest)).rejects.toThrow(
      /unsupported archive format/i,
    );
    expect(readdirSync(dest)).toEqual([]);
  });

  it('rejects entries escaping the destination without writing anything', async () => {
    const dest = makeDestDir();
    const archive = buildTarGz([
      { path: 'SKILL.md', content: Buffer.from('ok') },
      { path: '../escaped.md', content: Buffer.from('bad') },
    ]);

    await expect(extractArchive(archive, dest)).rejects.toThrow(/unsafe archive path/i);
    expect(readdirSync(dest)).toEqual([]);
    expect(existsSync(join(dest, '..', 'escaped.md'))).toBe(false);
  });

  it('rejects absolute entry paths', async () => {
    const dest = makeDestDir();
    const archive = buildTarGz([{ path: '/etc/passwd', content: Buffer.from('bad') }]);

    await expect(extractArchive(archive, dest)).rejects.toThrow(/unsafe archive path/i);
    expect(readdirSync(dest)).toEqual([]);
  });

  it('rejects an archive over the unpacked size cap', async () => {
    const dest = makeDestDir();
    const archive = buildTarGz([
      { path: 'big.bin', content: Buffer.alloc(51 * 1024 * 1024) },
    ]);

    await expect(extractArchive(archive, dest)).rejects.toThrow(/limit/i);
    expect(readdirSync(dest)).toEqual([]);
  }, 30_000);

  it('rejects an archive over the file count cap', async () => {
    const dest = makeDestDir();
    const entries = Array.from({ length: 1001 }, (_, i) => ({
      path: `f${i}.md`,
      content: Buffer.from('x'),
    }));

    await expect(extractArchive(buildTarGz(entries), dest)).rejects.toThrow(/too many/i);
    expect(readdirSync(dest)).toEqual([]);
  }, 30_000);

  it('accepts an archive exactly at the file count cap', async () => {
    const dest = makeDestDir();
    const entries = Array.from({ length: 1000 }, (_, i) => ({
      path: `f${i}.md`,
      content: Buffer.from('x'),
    }));

    await extractArchive(buildTarGz(entries), dest);

    expect(readdirSync(dest)).toHaveLength(1000);
  }, 30_000);
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { createServer, type Server } from 'http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { gzipSync } from 'zlib';

const execFileAsync = promisify(execFile);

const CLI = join(import.meta.dirname, '..', 'dist', 'index.js');

function skillMd(name: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${name} skill\n---\n${body}\n`;
}

function sha256(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
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

/** In-memory fixture site: routes are mutable so `update` can see new bytes. */
class FixtureSite {
  private server: Server | undefined;
  private readonly routes = new Map<string, Buffer>();
  port = 0;

  setRoute(path: string, body: string | Buffer): void {
    this.routes.set(path, Buffer.isBuffer(body) ? body : Buffer.from(body));
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const body = this.routes.get(req.url ?? '');
      if (!body) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-length': String(body.length) }).end(body);
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    this.server = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  get origin(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  get hostDir(): string {
    return `127.0.0.1_${this.port}`;
  }
}

describe('well-known install E2E', () => {
  let site: FixtureSite;
  let home: string;

  // Async on purpose: the fixture server shares this process's event loop, so a
  // synchronous child call would deadlock every request the CLI makes.
  async function run(args: string[]): Promise<string> {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args], {
      env: { ...process.env, HOME: home },
    });
    return `${stdout}${stderr}`;
  }

  function readSources(): {
    version: string;
    sources: Record<string, { skillDigests?: Record<string, string> }>;
    bundles: Record<string, unknown>;
  } {
    return JSON.parse(readFileSync(join(home, '.skills-manager', 'sources.json'), 'utf8'));
  }

  function skillPath(name: string, file = 'SKILL.md'): string {
    return join(home, '.skills-manager', 'well-known', site.hostDir, name, file);
  }

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'smgr-wk-home-'));
    site = new FixtureSite();
    await site.start();
  });

  afterEach(async () => {
    await site.stop();
    rmSync(home, { recursive: true, force: true });
  });

  function serveV1(alphaBody: string): void {
    site.setRoute(
      '/.well-known/agent-skills/index.json',
      JSON.stringify({
        skills: [
          { name: 'alpha', description: 'Alpha skill', files: ['SKILL.md', 'refs/a.md'] },
          { name: 'beta', description: 'Beta skill', files: ['SKILL.md'] },
          { name: 'BAD_NAME', description: 'Rejected', files: ['SKILL.md'] },
        ],
      }),
    );
    site.setRoute('/.well-known/agent-skills/alpha/SKILL.md', skillMd('alpha', alphaBody));
    site.setRoute('/.well-known/agent-skills/alpha/refs/a.md', 'alpha reference');
    site.setRoute('/.well-known/agent-skills/beta/SKILL.md', skillMd('beta', 'beta v1'));
  }

  it('runs install -> list -> update -> uninstall against a v0.1.0 index', async () => {
    serveV1('alpha v1');

    const installOut = await run(['install', site.origin, '--all']);
    expect(installOut).toContain('Found 2 skill(s)');
    expect(readFileSync(skillPath('alpha'), 'utf8')).toContain('alpha v1');
    expect(readFileSync(skillPath('alpha', 'refs/a.md'), 'utf8')).toBe('alpha reference');
    expect(existsSync(skillPath('beta'))).toBe(true);
    expect(existsSync(skillPath('BAD_NAME'))).toBe(false);

    const sources = readSources();
    const key = `well-known/${site.hostDir}`;
    expect(sources.version).toBe('3.0');
    expect(sources.bundles).toEqual({});
    expect(Object.keys(sources.sources)).toEqual([key]);
    expect(Object.keys(sources.sources[key].skillDigests ?? {}).sort())
      .toEqual(['alpha', 'beta']);

    const listOut = await run(['list']);
    expect(listOut).toContain('alpha');
    expect(listOut).toContain('beta');

    const digestsBefore = readSources().sources[key].skillDigests!;
    serveV1('alpha v2');
    const updateOut = await run(['update', site.hostDir]);
    expect(updateOut).toContain('↑ alpha: updated');
    expect(updateOut).toContain('✓ beta: up to date');
    expect(readFileSync(skillPath('alpha'), 'utf8')).toContain('alpha v2');

    const digestsAfter = readSources().sources[key].skillDigests!;
    expect(digestsAfter.alpha).not.toBe(digestsBefore.alpha);
    expect(digestsAfter.beta).toBe(digestsBefore.beta);

    await run(['uninstall', site.origin, '--all', '--force']);
    expect(existsSync(skillPath('alpha'))).toBe(false);
    expect(existsSync(skillPath('beta'))).toBe(false);
    expect(readSources().sources[key]).toBeUndefined();
  }, 120_000);

  it('installs a v0.2.0 index with skill-md and archive artifacts', async () => {
    const mdArtifact = Buffer.from(skillMd('gamma', 'gamma from artifact'));
    const archive = buildTarGz([
      { path: 'SKILL.md', content: Buffer.from(skillMd('delta', 'delta packed')) },
      { path: 'refs/d.md', content: Buffer.from('delta reference') },
    ]);
    site.setRoute('/artifacts/gamma.md', mdArtifact);
    site.setRoute('/artifacts/delta.tar.gz', archive);
    site.setRoute(
      '/.well-known/agent-skills/index.json',
      JSON.stringify({
        $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
        skills: [
          {
            name: 'gamma',
            type: 'skill-md',
            description: 'Gamma skill',
            url: '/artifacts/gamma.md',
            digest: sha256(mdArtifact),
          },
          {
            name: 'delta',
            type: 'archive',
            description: 'Delta skill',
            url: '/artifacts/delta.tar.gz',
            digest: sha256(archive),
          },
          {
            name: 'tampered',
            type: 'skill-md',
            description: 'Digest will not match',
            url: '/artifacts/gamma.md',
            digest: `sha256:${'0'.repeat(64)}`,
          },
        ],
      }),
    );

    await run(['install', site.origin, '--all']);

    expect(readFileSync(skillPath('gamma'), 'utf8')).toContain('gamma from artifact');
    expect(readFileSync(skillPath('delta'), 'utf8')).toContain('delta packed');
    expect(readFileSync(skillPath('delta', 'refs/d.md'), 'utf8')).toBe('delta reference');
    expect(existsSync(skillPath('tampered'))).toBe(false);

    const key = `well-known/${site.hostDir}`;
    const digests = readSources().sources[key].skillDigests!;
    expect(Object.keys(digests).sort()).toEqual(['delta', 'gamma']);
    expect(digests.gamma).toBe(sha256(mdArtifact));

    const updateOut = await run(['update', site.hostDir]);
    expect(updateOut).toContain('✓ gamma: up to date');
    expect(updateOut).toContain('✓ delta: up to date');
  }, 120_000);

  it('errors with probed URLs and the .git hint when nothing is published', async () => {
    let stderr = '';
    let failed = false;

    try {
      await run(['install', site.origin, '--all']);
    } catch (error) {
      failed = true;
      stderr = `${(error as { stderr?: Buffer }).stderr ?? ''}` +
        `${(error as { stdout?: Buffer }).stdout ?? ''}`;
    }

    expect(failed).toBe(true);
    expect(stderr).toContain(`${site.origin}/.well-known/agent-skills/index.json`);
    expect(stderr).toContain(`${site.origin}/.well-known/skills/index.json`);
    expect(stderr).toContain('.git');
    expect(existsSync(join(home, '.skills-manager', 'well-known', site.hostDir))).toBe(false);
  }, 120_000);

  it('falls back to the legacy well-known path', async () => {
    site.setRoute(
      '/.well-known/skills/index.json',
      JSON.stringify({
        skills: [{ name: 'legacy', description: 'Legacy skill', files: ['SKILL.md'] }],
      }),
    );
    site.setRoute('/.well-known/skills/legacy/SKILL.md', skillMd('legacy', 'legacy v1'));

    await run(['install', site.origin, '--all']);

    expect(readFileSync(skillPath('legacy'), 'utf8')).toContain('legacy v1');
  }, 120_000);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./install-git.js', () => ({
  installViaGitClone: vi.fn(async () => ({
    basePath: '',
    sourceKey: '',
    installedPaths: [],
    sourceKeys: [],
  })),
}));

import * as constants from '../constants.js';
import { installViaGitClone } from './install-git.js';
import { installSource } from './install.js';
import { SkillsService } from '../services/skills.js';

const V1_INDEX = {
  skills: [
    { name: 'alpha', description: 'Alpha skill', files: ['SKILL.md'] },
    { name: 'beta', description: 'Beta skill', files: ['SKILL.md'] },
  ],
};

function preferredIndexUrl(origin: string): string {
  return `${origin}/.well-known/agent-skills/index.json`;
}

function legacyIndexUrl(origin: string): string {
  return `${origin}/.well-known/skills/index.json`;
}

function skillFileUrl(origin: string, name: string): string {
  return `${origin}/.well-known/agent-skills/${name}/SKILL.md`;
}

function serveIndex(origin: string, index: unknown): Record<string, () => Response> {
  const routes: Record<string, () => Response> = {
    [preferredIndexUrl(origin)]: () => new Response(JSON.stringify(index), { status: 200 }),
  };
  for (const entry of (index as { skills: Array<{ name: string }> }).skills) {
    routes[skillFileUrl(origin, entry.name)] = () =>
      new Response(`---\nname: ${entry.name}\ndescription: ${entry.name} skill\n---\n`);
  }
  return routes;
}

function stubRoutes(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string) => {
    const handler = routes[url];
    return handler ? handler() : new Response('nope', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('installFromWellKnown', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-install-wellknown-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(installViaGitClone).mockClear();
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readSources() {
    return JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
  }

  function seedSources(): void {
    writeFileSync(
      join(testManagerDir, 'sources.json'),
      JSON.stringify({
        version: '3.0',
        sources: {
          'community/owner/repo': {
            url: 'https://github.com/owner/repo',
            type: 'community',
            repoName: 'repo',
            installMethod: 'git',
            installedAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
          },
          'registry/pkg': {
            url: 'https://skillsmgr.dev/pkg',
            type: 'registry',
            repoName: 'pkg',
            installMethod: 'registry',
            version: '1.0.0',
            installedAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
          },
        },
        bundles: {},
      }),
    );
  }

  it('records well-known source metadata', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    expect(readSources().sources['well-known/example.com']).toMatchObject({
      url: 'https://example.com',
      type: 'well-known',
      installMethod: 'well-known',
      repoName: 'example.com',
    });
  });

  it('records a digest for every installed skill', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    const digests = readSources().sources['well-known/example.com'].skillDigests;
    expect(Object.keys(digests).sort()).toEqual(['alpha', 'beta']);
    expect(digests.alpha).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(digests.beta).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('keeps sources.json at version 3.0 and adds no bundles', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    const sources = readSources();
    expect(sources.version).toBe('3.0');
    expect(sources.bundles).toEqual({});
  });

  it('leaves pre-existing git and registry sources untouched', async () => {
    seedSources();
    const before = readSources().sources;
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    const after = readSources().sources;
    expect(after['community/owner/repo']).toEqual(before['community/owner/repo']);
    expect(after['registry/pkg']).toEqual(before['registry/pkg']);
    expect(Object.keys(after).sort()).toEqual([
      'community/owner/repo',
      'registry/pkg',
      'well-known/example.com',
    ]);
  });
});

describe('well-known discovery failure', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-wellknown-fail-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(installViaGitClone).mockClear();
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('errors listing both probed URLs and the .git hint, without cloning', async () => {
    stubRoutes({});

    await expect(installSource('https://example.com', {})).rejects.toThrow(
      /Cannot install from https:\/\/example\.com/,
    );
    expect(installViaGitClone).not.toHaveBeenCalled();

    await installSource('https://example.com', {}).catch((error: Error) => {
      expect(error.message).toContain(preferredIndexUrl('https://example.com'));
      expect(error.message).toContain(legacyIndexUrl('https://example.com'));
      expect(error.message).toContain('.git');
    });
  });

  it('errors with per-entry reasons when no entry survives validation', async () => {
    stubRoutes({
      [preferredIndexUrl('https://example.com')]: () =>
        new Response(
          JSON.stringify({ skills: [{ name: 'BAD', description: 'x', files: ['SKILL.md'] }] }),
        ),
    });

    await expect(installSource('https://example.com', {})).rejects.toThrow(/BAD/);
    expect(installViaGitClone).not.toHaveBeenCalled();
  });

  it('errors instead of cloning a bare self-hosted git URL', async () => {
    stubRoutes({});

    await expect(installSource('https://git.company.com/team/skills', {})).rejects.toThrow(
      /Cannot install from/,
    );
    expect(installViaGitClone).not.toHaveBeenCalled();
  });

  it('still routes a .git suffixed URL to git clone without probing', async () => {
    const fetchMock = stubRoutes({});

    await installSource('https://git.company.com/team/skills.git', {});

    expect(installViaGitClone).toHaveBeenCalledWith(
      'https://git.company.com/team/skills.git',
      expect.anything(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('well-known storage layout', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-wellknown-layout-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('installs under well-known/{host}/{skill}/', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    expect(existsSync(join(testManagerDir, 'well-known/example.com/alpha/SKILL.md'))).toBe(true);
    expect(existsSync(join(testManagerDir, 'well-known/example.com/beta/SKILL.md'))).toBe(true);
  });

  it('replaces the port separator in the directory name', async () => {
    stubRoutes(serveIndex('http://127.0.0.1:8787', V1_INDEX));

    await installSource('http://127.0.0.1:8787', {});

    expect(existsSync(join(testManagerDir, 'well-known/127.0.0.1_8787/alpha/SKILL.md')))
      .toBe(true);
    expect(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'))
      .toContain('well-known/127.0.0.1_8787');
  });

  it('lowercases the hostname in the path and the source key', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://Example.COM', {});

    const sources = JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
    expect(Object.keys(sources.sources)).toEqual(['well-known/example.com']);
    expect(existsSync(join(testManagerDir, 'well-known/example.com/alpha'))).toBe(true);
  });

  it('warns about script files landed by the install', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const origin = 'https://example.com';
    const index = {
      skills: [{ name: 'alpha', description: 'Alpha skill', files: ['SKILL.md', 'run.sh'] }],
    };
    stubRoutes({
      [preferredIndexUrl(origin)]: () => new Response(JSON.stringify(index)),
      [skillFileUrl(origin, 'alpha')]: () => new Response('---\nname: alpha\n---\n'),
      [`${origin}/.well-known/agent-skills/alpha/run.sh`]: () => new Response('echo hi'),
    });

    await installSource(origin, {});

    expect(warn.mock.calls.flat().join(' ')).toContain('run.sh');
  });

  it('exposes installed skills to the skill enumeration', async () => {
    stubRoutes(serveIndex('https://example.com', V1_INDEX));

    await installSource('https://example.com', {});

    const skills = new SkillsService(testManagerDir).getAllSkills();
    const names = skills.map((skill) => skill.name).sort();
    expect(names).toEqual(['alpha', 'beta']);
    expect(skills.every((skill) => skill.source === 'well-known/example.com')).toBe(true);
  });
});

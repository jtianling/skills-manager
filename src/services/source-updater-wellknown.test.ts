import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { SourceInfo, SourcesService } from './sources.js';
import { SourceUpdater } from './source-updater.js';
import { computeSkillDigest } from './wellknown/digest.js';

const ORIGIN = 'https://example.com';
const KEY = 'well-known/example.com';
const INDEX_URL = `${ORIGIN}/.well-known/agent-skills/index.json`;

function skillBody(name: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${name} skill\n---\n${body}`;
}

function digestOf(content: string): string {
  return computeSkillDigest(new Map([['SKILL.md', Buffer.from(content)]]));
}

function indexFor(names: string[]): unknown {
  return {
    skills: names.map((name) => ({
      name,
      description: `${name} skill`,
      files: ['SKILL.md'],
    })),
  };
}

function stubSite(remote: Record<string, string>, names = Object.keys(remote)) {
  const routes: Record<string, () => Response> = {
    [INDEX_URL]: () => new Response(JSON.stringify(indexFor(names))),
  };
  for (const [name, content] of Object.entries(remote)) {
    routes[`${ORIGIN}/.well-known/agent-skills/${name}/SKILL.md`] = () =>
      new Response(content);
  }

  const fetchMock = vi.fn(async (url: string) => {
    const handler = routes[url];
    return handler ? handler() : new Response('nope', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('SourceUpdater well-known updates', () => {
  let testManagerDir: string;
  let sourcesService: SourcesService;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-updater-wellknown-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    sourcesService = new SourcesService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function installLocal(name: string, content: string): string {
    const dir = join(testManagerDir, KEY, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content);
    return dir;
  }

  function seedSource(skillDigests: Record<string, string>): SourceInfo {
    sourcesService.addSource(KEY, {
      url: ORIGIN,
      type: 'well-known',
      repoName: 'example.com',
      installMethod: 'well-known',
      skillDigests,
    });
    return sourcesService.getSource(KEY)!;
  }

  it('reinstalls a skill whose digest moved and writes the new digest back', async () => {
    const oldContent = skillBody('alpha', 'old');
    const newContent = skillBody('alpha', 'new');
    installLocal('alpha', oldContent);
    const info = seedSource({ alpha: digestOf(oldContent) });
    stubSite({ alpha: newContent });

    const result = await new SourceUpdater(sourcesService).updateSource(KEY, info);

    expect(result).toMatchObject({ updated: 1, upToDate: 0, failed: 0 });
    expect(readFileSync(join(testManagerDir, KEY, 'alpha/SKILL.md'), 'utf-8'))
      .toBe(newContent);
    expect(sourcesService.getSource(KEY)!.skillDigests).toEqual({
      alpha: digestOf(newContent),
    });
  });

  it('counts an unchanged skill as up to date and leaves it alone', async () => {
    const content = skillBody('alpha', 'same');
    const dir = installLocal('alpha', content);
    const info = seedSource({ alpha: digestOf(content) });
    stubSite({ alpha: content });
    const before = statSync(join(dir, 'SKILL.md')).mtimeMs;

    const result = await new SourceUpdater(sourcesService).updateSource(KEY, info);

    expect(result).toMatchObject({ updated: 0, upToDate: 1, failed: 0 });
    expect(statSync(join(dir, 'SKILL.md')).mtimeMs).toBe(before);
  });

  it('keeps a locally installed skill that the remote index dropped', async () => {
    const content = skillBody('gamma', 'local only');
    installLocal('gamma', content);
    const info = seedSource({ gamma: digestOf(content) });
    stubSite({ delta: skillBody('delta', 'still published') });

    const result = await new SourceUpdater(sourcesService).updateSource(KEY, info);

    expect(result).toMatchObject({ updated: 0, upToDate: 0, failed: 1 });
    expect(existsSync(join(testManagerDir, KEY, 'gamma/SKILL.md'))).toBe(true);
    expect(console.log).toHaveBeenCalledWith('  ⚠ gamma: not found in remote');
  });

  it('reinstalls only the changed skill and leaves the other untouched', async () => {
    const alphaOld = skillBody('alpha', 'old');
    const alphaNew = skillBody('alpha', 'new');
    const beta = skillBody('beta', 'stable');
    installLocal('alpha', alphaOld);
    const betaDir = installLocal('beta', beta);
    const info = seedSource({ alpha: digestOf(alphaOld), beta: digestOf(beta) });
    stubSite({ alpha: alphaNew, beta });
    const betaMtime = statSync(join(betaDir, 'SKILL.md')).mtimeMs;

    const result = await new SourceUpdater(sourcesService).updateSource(KEY, info);

    expect(result).toMatchObject({ updated: 1, upToDate: 1, failed: 0 });
    expect(readFileSync(join(betaDir, 'SKILL.md'), 'utf-8')).toBe(beta);
    expect(statSync(join(betaDir, 'SKILL.md')).mtimeMs).toBe(betaMtime);
    expect(sourcesService.getSource(KEY)!.skillDigests).toEqual({
      alpha: digestOf(alphaNew),
      beta: digestOf(beta),
    });
  });

  it('never clones a repository for a well-known source', async () => {
    const content = skillBody('alpha', 'same');
    installLocal('alpha', content);
    const info = seedSource({ alpha: digestOf(content) });
    stubSite({ alpha: content });
    const cloneRepo = vi.fn();

    await new SourceUpdater(
      sourcesService,
      undefined,
      undefined,
      undefined,
      cloneRepo as never,
    ).updateSource(KEY, info);

    expect(cloneRepo).not.toHaveBeenCalled();
  });

  it('skips a source whose type the current version does not know', async () => {
    const fetchMock = stubSite({});
    const unknown = {
      url: 'https://github.com/owner/repo',
      type: 'future-source' as unknown as SourceInfo['type'],
      repoName: 'repo',
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies SourceInfo;
    const cloneRepo = vi.fn();

    const result = await new SourceUpdater(
      sourcesService,
      undefined,
      undefined,
      undefined,
      cloneRepo as never,
    ).updateSource('future/repo', unknown);

    expect(result).toEqual({ updated: 0, upToDate: 0, failed: 0, skipped: 1 });
    expect(cloneRepo).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps an existing git installMethod on a non-git host instead of migrating', async () => {
    const fetchMock = stubSite({});
    const legacy: SourceInfo = {
      url: 'https://git.example.com/example/skills',
      type: 'community',
      repoName: 'skills',
      installMethod: 'git',
      installedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const skillDir = join(testManagerDir, 'community/example/skills/alpha');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), skillBody('alpha', 'local'));

    const cloneRepo = vi.fn(async () => ({ repoPath: '/nonexistent', cleanup: () => {} }));
    const result = await new SourceUpdater(
      sourcesService,
      undefined,
      undefined,
      undefined,
      cloneRepo as never,
      () => [],
    ).updateSource('community/example/skills', legacy);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      '  ⚠ Cannot parse URL: https://git.example.com/example/skills',
    );
    expect(result).toEqual({ updated: 0, upToDate: 0, failed: 0, skipped: 0 });
  });
});

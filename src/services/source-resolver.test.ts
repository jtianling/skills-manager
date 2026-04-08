import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Bundle, SkillInfo } from '../types.js';
import { SourceResolver } from './source-resolver.js';
import { makeBundleId } from '../utils/url-normalize.js';

vi.mock('../utils/prompts.js', () => ({
  promptSelect: vi.fn().mockResolvedValue('community/acme/other/shared-skill'),
}));

function createSkillDir(path: string, name: string): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test\n---\n`
  );
}

describe('SourceResolver', () => {
  let testRoot: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testRoot = join(tmpdir(), `skillsmgr-source-resolver-${id}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createResolver(options?: {
    sources?: Record<string, {
      url: string;
      type: 'official' | 'community' | 'custom' | 'registry';
      repoName: string;
      installMethod?: 'git' | 'zip' | 'local-copy' | 'registry';
      version?: string;
      registryUrl?: string;
      installedAt?: string;
      updatedAt?: string;
    }>;
    skills?: SkillInfo[];
    bundles?: Record<string, Bundle>;
    parseGitHubUrl?: (url: string) => { owner: string; repo: string } | null;
  }): SourceResolver {
    const sources = options?.sources ?? {};
    const skills = options?.skills ?? [];
    const bundles = options?.bundles ?? {};
    const parseGitHubUrl =
      options?.parseGitHubUrl ??
      ((url: string) => {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (!match) {
          return null;
        }
        return { owner: match[1], repo: match[2] };
      });

    return new SourceResolver(
      {
        getAllSources: () => sources,
        findBundleByUrl: (normalizedUrl: string, type: 'local-batch' | 'git' | 'zip') =>
          bundles[makeBundleId(type, normalizedUrl)],
      } as never,
      {
        getAllSkills: () => skills,
      } as never,
      {
        parseGitHubUrl,
      } as never
    );
  }

  it('resolves official owner/repo with provider translation', async () => {
    const resolver = createResolver({
      sources: {
        'official/anthropic/skills': {
          url: 'https://github.com/anthropics/skills',
          type: 'official',
          repoName: 'skills',
        },
      },
    });

    const result = await resolver.resolve('anthropics/skills');

    expect(result).toMatchObject({
      kind: 'source',
      sourceKeys: ['official/anthropic/skills'],
    });
  });

  it('resolves community owner/repo directly', async () => {
    const resolver = createResolver({
      sources: {
        'community/obra/superpowers': {
          url: 'https://github.com/obra/superpowers',
          type: 'community',
          repoName: 'superpowers',
        },
      },
    });

    const result = await resolver.resolve('obra/superpowers');

    expect(result).toMatchObject({
      kind: 'source',
      sourceKeys: ['community/obra/superpowers'],
    });
  });

  it('resolves official alias owner/repo', async () => {
    const resolver = createResolver({
      sources: {
        'official/vercel-labs/agent-skills': {
          url: 'https://github.com/vercel/agent-skills',
          type: 'official',
          repoName: 'agent-skills',
        },
      },
    });

    const result = await resolver.resolve('vercel/agent-skills');

    expect(result).toMatchObject({
      kind: 'source',
      sourceKeys: ['official/vercel-labs/agent-skills'],
    });
  });

  it('normalizes https, ssh, dot-git, and gitlab URLs', async () => {
    const resolver = createResolver({
      sources: {
        'community/obra/superpowers': {
          url: 'https://github.com/obra/superpowers',
          type: 'community',
          repoName: 'superpowers',
        },
        'community/foo/bar': {
          url: 'https://gitlab.com/foo/bar.git',
          type: 'community',
          repoName: 'bar',
        },
      },
      parseGitHubUrl: (url: string) => {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (!match) {
          return null;
        }
        return { owner: match[1], repo: match[2] };
      },
    });

    await expect(resolver.resolve('https://github.com/obra/superpowers'))
      .resolves.toMatchObject({
        kind: 'source',
        sourceKeys: ['community/obra/superpowers'],
      });
    await expect(resolver.resolve('https://github.com/obra/superpowers.git'))
      .resolves.toMatchObject({
        kind: 'source',
        sourceKeys: ['community/obra/superpowers'],
      });
    await expect(resolver.resolve('git@github.com:obra/superpowers.git'))
      .resolves.toMatchObject({
        kind: 'source',
        sourceKeys: ['community/obra/superpowers'],
      });
    await expect(resolver.resolve('https://gitlab.com/foo/bar'))
      .resolves.toMatchObject({
        kind: 'source',
        sourceKeys: ['community/foo/bar'],
      });
  });

  it('resolves owner/repo:skill and reports missing skill', async () => {
    const skills: SkillInfo[] = [
      {
        name: 'my-skill',
        description: '',
        path: join(testRoot, 'community', 'obra', 'superpowers', 'my-skill'),
        source: 'community/obra/superpowers',
      },
    ];
    const resolver = createResolver({
      sources: {
        'community/obra/superpowers': {
          url: 'https://github.com/obra/superpowers',
          type: 'community',
          repoName: 'superpowers',
        },
      },
      skills,
    });

    await expect(resolver.resolve('obra/superpowers:my-skill')).resolves.toMatchObject({
      kind: 'skill',
      sourceKeys: ['community/obra/superpowers'],
      skills: [skills[0]],
    });
    await expect(resolver.resolve('obra/superpowers:missing')).resolves.toMatchObject({
      kind: 'not-found',
    });
  });

  it('resolves registry package forms', async () => {
    const resolver = createResolver({
      sources: {
        'registry/code-review': {
          url: 'https://skillsmgr.dev/api/r/code-review',
          type: 'registry',
          repoName: 'code-review',
          installMethod: 'registry',
          version: '1.0.0',
        },
        'registry/@acme/skill-x': {
          url: 'https://skillsmgr.dev/api/r/@acme/skill-x',
          type: 'registry',
          repoName: '@acme/skill-x',
          installMethod: 'registry',
          version: '1.0.0',
        },
      },
    });

    await expect(resolver.resolve('code-review')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['registry/code-review'],
    });
    await expect(resolver.resolve('code-review@1.2.0')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['registry/code-review'],
      requestedVersion: '1.2.0',
    });
    await expect(resolver.resolve('@acme/skill-x')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['registry/@acme/skill-x'],
    });
  });

  it('resolves local single-skill path and bundle-backed batch path', async () => {
    const singleSkillDir = join(testRoot, 'local-single');
    const batchDir = join(testRoot, 'spec-tdd');
    createSkillDir(singleSkillDir, 'local-single');
    createSkillDir(join(batchDir, 'child-a'), 'child-a');
    createSkillDir(join(batchDir, 'child-b'), 'child-b');

    const resolver = createResolver({
      sources: {
        'custom/local-single': {
          url: singleSkillDir,
          type: 'custom',
          repoName: 'local-single',
          installMethod: 'local-copy',
        },
      },
      bundles: {
        [makeBundleId('local-batch', batchDir)]: {
          type: 'local-batch',
          url: batchDir,
          selectionMode: 'all',
          members: ['custom/spec-tdd/child-a', 'custom/spec-tdd/child-b'],
          installedAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    });

    await expect(resolver.resolve(singleSkillDir)).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['custom/local-single'],
    });
    await expect(resolver.resolve(batchDir)).resolves.toMatchObject({
      kind: 'bundle',
      bundleId: makeBundleId('local-batch', batchDir),
      sourceKeys: ['custom/spec-tdd/child-a', 'custom/spec-tdd/child-b'],
    });
    await expect(resolver.resolve(join(testRoot, 'missing-skill'))).resolves.toMatchObject({
      kind: 'not-found',
      reason: expect.stringContaining('No installed skill found from path'),
    });
  });

  it('prefers bundle resolution for owner/repo and repository url', async () => {
    const bundleId = 'git:https://github.com/anthropics/skills';
    const resolver = createResolver({
      sources: {
        'official/anthropic/skills': {
          url: 'https://github.com/anthropics/skills',
          type: 'official',
          repoName: 'skills',
          installMethod: 'git',
        },
      },
      bundles: {
        [bundleId]: {
          type: 'git',
          url: 'https://github.com/anthropics/skills',
          selectionMode: 'all',
          members: ['official/anthropic/skills'],
          installedAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    });

    await expect(resolver.resolve('anthropics/skills')).resolves.toMatchObject({
      kind: 'bundle',
      bundleId,
      sourceKeys: ['official/anthropic/skills'],
    });
    await expect(resolver.resolve('https://github.com/anthropics/skills')).resolves.toMatchObject({
      kind: 'bundle',
      bundleId,
      sourceKeys: ['official/anthropic/skills'],
    });
  });

  it('resolves bareword by registry, source suffix, repo name, and skill name priority', async () => {
    const sharedSkillPath = join(testRoot, 'shared-skill');
    createSkillDir(sharedSkillPath, 'shared-skill');

    const skillMatch: SkillInfo = {
      name: 'shared-skill',
      description: '',
      path: sharedSkillPath,
      source: 'community/acme/other',
    };
    const resolver = createResolver({
      sources: {
        'registry/code-review': {
          url: 'https://skillsmgr.dev/api/r/code-review',
          type: 'registry',
          repoName: 'code-review',
          installMethod: 'registry',
          version: '1.0.0',
        },
        'community/obra/superpowers': {
          url: 'https://github.com/obra/superpowers',
          type: 'community',
          repoName: 'repo-by-name',
        },
        'community/acme/repo-by-name': {
          url: 'https://github.com/acme/repo-by-name',
          type: 'community',
          repoName: 'repo-by-name',
        },
      },
      skills: [skillMatch],
    });

    await expect(resolver.resolve('code-review')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['registry/code-review'],
    });
    await expect(resolver.resolve('superpowers')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['community/obra/superpowers'],
    });
    await expect(resolver.resolve('repo-by-name')).resolves.toMatchObject({
      kind: 'source',
      sourceKeys: ['community/acme/repo-by-name'],
    });
    await expect(resolver.resolve('shared-skill')).resolves.toMatchObject({
      kind: 'skill',
      sourceKeys: ['community/acme/other'],
      skills: [skillMatch],
    });
    await expect(resolver.resolve('missing-bareword')).resolves.toMatchObject({
      kind: 'not-found',
      reason: expect.stringContaining('Tried:'),
    });
  });

  it('escalates source suffix bareword to skill disambiguation when same-name skills exist in multiple sources', async () => {
    const { promptSelect } = await import('../utils/prompts.js');
    vi.mocked(promptSelect).mockResolvedValueOnce(
      'custom/dev-dir/dup-skill/dup-skill'
    );

    const standaloneSkill: SkillInfo = {
      name: 'dup-skill',
      description: '',
      path: join(testRoot, 'custom', 'dup-skill'),
      source: 'custom/dup-skill',
    };
    const nestedSkill: SkillInfo = {
      name: 'dup-skill',
      description: '',
      path: join(testRoot, 'custom', 'dev-dir', 'dup-skill'),
      source: 'custom/dev-dir/dup-skill',
    };
    const resolver = createResolver({
      sources: {
        'custom/dup-skill': {
          url: join(testRoot, 'dup-skill'),
          type: 'custom',
          repoName: 'dup-skill',
          installMethod: 'local-copy',
        },
        'custom/dev-dir/dup-skill': {
          url: join(testRoot, 'dev-dir', 'dup-skill'),
          type: 'custom',
          repoName: 'dup-skill',
          installMethod: 'local-copy',
        },
      },
      skills: [standaloneSkill, nestedSkill],
    });

    const result = await resolver.resolve('dup-skill');

    expect(result).toMatchObject({
      kind: 'skill',
      sourceKeys: ['custom/dev-dir/dup-skill'],
      skills: [nestedSkill],
    });
  });

  it('returns manual reinstall guidance for zip sources', async () => {
    const resolver = createResolver();

    await expect(resolver.resolve('https://example.com/archive.zip')).resolves.toMatchObject({
      kind: 'not-found',
      reason: 'Zip sources require manual reinstall',
    });
  });
});

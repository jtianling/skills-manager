import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const gitCloneState = vi.hoisted(() => ({ repoPath: '' }));
const registryState = vi.hoisted(() => ({ skillNames: [] as string[] }));

vi.mock('../services/repo-clone.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/repo-clone.js')>();
  const { cpSync, mkdtempSync, rmSync: rm } = await import('fs');
  const { tmpdir: tmp } = await import('os');
  const { join: pjoin } = await import('path');

  return {
    ...actual,
    async cloneRepoToTemp() {
      const tempDir = mkdtempSync(pjoin(tmp(), 'smgr-group-keys-clone-'));
      const repoPath = pjoin(tempDir, 'repo');
      cpSync(gitCloneState.repoPath, repoPath, { recursive: true });
      return {
        repoPath,
        commitSha: 'c'.repeat(40),
        cleanup: () => rm(tempDir, { recursive: true, force: true }),
      };
    },
  };
});

vi.mock('../services/registry.js', () => {
  class RegistryService {
    async getPackument(name: string) {
      return {
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': { dist: { tarball: `https://registry.test/${name}.tgz` } },
        },
      };
    }

    async downloadTarball(_url: string, destDir: string) {
      const { mkdirSync: mkdir, writeFileSync: write } = await import('fs');
      const { join: pjoin } = await import('path');
      for (const skillName of registryState.skillNames) {
        const dir = pjoin(destDir, skillName);
        mkdir(dir, { recursive: true });
        write(
          pjoin(dir, 'SKILL.md'),
          `---\nname: ${skillName}\ndescription: ${skillName} skill\n---\n`,
        );
      }
    }
  }

  return { RegistryService };
});

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSkillsToInstall: vi.fn().mockResolvedValue({ names: [], isAll: false }),
}));

const registryOverride = vi.hoisted(() => ({ result: null as unknown }));

vi.mock('./install-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./install-registry.js')>();
  return {
    ...actual,
    installFromRegistry: async (
      ...args: Parameters<typeof actual.installFromRegistry>
    ) => registryOverride.result ?? actual.installFromRegistry(...args),
  };
});

import * as constants from '../constants.js';
import { executeInstall, installSource } from './install.js';
import { executeUninstall } from './uninstall.js';
import { rollbackInstall } from '../services/rollback.js';
import { SkillsService } from '../services/skills.js';
import { promptSkillsToInstall } from '../utils/prompts.js';

function writeSkillMd(dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} skill\n---\n# ${name}`,
  );
}

function wellKnownIndexUrl(origin: string): string {
  return `${origin}/.well-known/agent-skills/index.json`;
}

function stubWellKnown(origin: string, names: string[]): void {
  const index = {
    skills: names.map((name) => ({
      name,
      description: `${name} skill`,
      files: ['SKILL.md'],
    })),
  };

  const routes: Record<string, () => Response> = {
    [wellKnownIndexUrl(origin)]: () =>
      new Response(JSON.stringify(index), { status: 200 }),
  };
  for (const name of names) {
    routes[`${origin}/.well-known/agent-skills/${name}/SKILL.md`] = () =>
      new Response(`---\nname: ${name}\ndescription: ${name} skill\n---\n`);
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const handler = routes[url];
      return handler ? handler() : new Response('nope', { status: 404 });
    }),
  );
}

describe('install --group writes skill keys', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let repoPath: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-group-keys-mgr-${id}`);
    testProjectDir = join(tmpdir(), `smgr-group-keys-proj-${id}`);
    repoPath = join(tmpdir(), `smgr-group-keys-repo-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(testProjectDir, { recursive: true });
    mkdirSync(repoPath, { recursive: true });
    gitCloneState.repoPath = repoPath;
    registryState.skillNames = [];
    registryOverride.result = null;

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(promptSkillsToInstall).mockResolvedValue({ names: [], isAll: false });
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    rmSync(repoPath, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readGroups() {
    return JSON.parse(readFileSync(join(testManagerDir, 'groups.json'), 'utf-8'));
  }

  function readSources() {
    return JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
  }

  function writeRepoSkills(names: string[]): void {
    for (const name of names) {
      writeSkillMd(join(repoPath, name), name);
    }
  }

  function seedDevelopGroup(): string[] {
    const members = ['custom/a', 'custom/b', 'custom/c', 'custom/d', 'custom/e'];
    writeFileSync(
      join(testManagerDir, 'groups.json'),
      JSON.stringify({
        version: '2.0',
        groups: { develop: { kind: 'virtual', members } },
      }),
    );
    return members;
  }

  it('writes one full skill key per skill for a community source', async () => {
    for (const name of ['alpha', 'beta', 'gamma']) {
      writeSkillMd(join(repoPath, name), name);
    }

    await executeInstall('obra/superpowers', { all: true, group: 'tools' });

    const members = readGroups().groups.tools.members as string[];
    expect(members.sort()).toEqual([
      'community/obra/superpowers/alpha',
      'community/obra/superpowers/beta',
      'community/obra/superpowers/gamma',
    ]);
    expect(members).not.toContain('community/obra/superpowers');
  });

  it('writes one full skill key per skill for a registry source', async () => {
    registryState.skillNames = ['pack-one', 'pack-two'];

    await executeInstall('my-pack@1.0.0', { all: true, group: 'tools' });

    const members = readGroups().groups.tools.members as string[];
    expect(members.sort()).toEqual([
      'registry/my-pack/pack-one',
      'registry/my-pack/pack-two',
    ]);
    expect(members).not.toContain('registry/my-pack');
  });

  it('writes one full skill key per skill for a well-known source', async () => {
    const names = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    stubWellKnown('https://docs.example.com', names);

    await executeInstall('https://docs.example.com', { all: true, group: 'site' });

    const members = readGroups().groups.site.members as string[];
    expect(members.sort()).toEqual(
      names.map((n) => `well-known/docs.example.com/${n}`),
    );
    expect(members).not.toContain('well-known/docs.example.com');
  });

  it('adds exactly the selected skills and leaves the rest out', async () => {
    const names = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    stubWellKnown('https://docs.example.com', names);
    vi.mocked(promptSkillsToInstall).mockResolvedValue({
      names: ['s1', 's4', 's7'],
      isAll: false,
    });

    await executeInstall('https://docs.example.com', { group: 'site' });

    const members = readGroups().groups.site.members as string[];
    expect(members).toHaveLength(3);
    expect(members.sort()).toEqual([
      'well-known/docs.example.com/s1',
      'well-known/docs.example.com/s4',
      'well-known/docs.example.com/s7',
    ]);
    for (const skipped of ['s2', 's3', 's5', 's6', 's8']) {
      expect(members).not.toContain(`well-known/docs.example.com/${skipped}`);
    }
  });

  it('leaves other groups untouched', async () => {
    const developMembers = seedDevelopGroup();
    for (const name of ['alpha', 'beta', 'gamma']) {
      writeSkillMd(join(repoPath, name), name);
    }

    await executeInstall('obra/superpowers', { all: true, group: 'tools' });

    const groups = readGroups().groups;
    expect(groups.develop).toEqual({ kind: 'virtual', members: developMembers });
    expect(groups.tools.members).toHaveLength(3);
  });

  it('reports the same skill keys in --json output as in groups.json', async () => {
    for (const name of ['alpha', 'beta']) {
      writeSkillMd(join(repoPath, name), name);
    }
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await executeInstall('obra/superpowers', { all: true, group: 'tools', json: true });

    const jsonCall = stdoutSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('"installed"'),
    );
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.installed.skills).toEqual([
      'community/obra/superpowers/alpha',
      'community/obra/superpowers/beta',
    ]);
    expect(parsed.installed.skills).toEqual(readGroups().groups.tools.members);
  });

  it('fails instead of silently skipping when no skill key is produced', async () => {
    registryOverride.result = {
      basePath: '/tmp/fake',
      sourceKey: 'registry/my-pack',
      installedPaths: ['/tmp/fake'],
      sourceKeys: ['registry/my-pack'],
    };
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      executeInstall('my-pack@1.0.0', { all: true, group: 'tools' }),
    ).rejects.toThrow('process.exit');

    expect(console.error).toHaveBeenCalledWith(
      "Error: Cannot add to group 'tools': the install produced no skill keys.",
    );
    expect(existsSync(join(testManagerDir, 'groups.json'))).toBe(false);
    mockExit.mockRestore();
  });

  it('resolves every group member back to an installed skill', async () => {
    writeRepoSkills(['alpha', 'beta', 'gamma']);

    await executeInstall('obra/superpowers', { all: true, group: 'tools' });

    const allSkills = new SkillsService(constants.SKILLS_MANAGER_DIR).getAllSkills();
    const members = readGroups().groups.tools.members as string[];
    const unresolved = members.filter(
      (key) => !allSkills.some((s) => `${s.source}/${s.name}` === key),
    );
    expect(unresolved).toEqual([]);
  });

  it('leaves sourceKeys as source keys so rollback cleans sources.json', async () => {
    writeRepoSkills(['alpha', 'beta', 'gamma']);

    const result = await installSource('obra/superpowers', {});

    expect(result.sourceKeys).toEqual(['community/obra/superpowers']);
    expect(result.skillKeys).toHaveLength(3);
    expect(readSources().sources['community/obra/superpowers']).toBeDefined();

    rollbackInstall(
      result.basePath,
      result.sourceKey,
      result.installedPaths,
      result.sourceKeys,
    );

    expect(readSources().sources['community/obra/superpowers']).toBeUndefined();
    for (const path of result.installedPaths ?? []) {
      expect(existsSync(path)).toBe(false);
    }
  });

  it('clears the group on uninstall without touching other groups', async () => {
    const developMembers = seedDevelopGroup();
    writeRepoSkills(['alpha', 'beta', 'gamma']);

    await executeInstall('obra/superpowers', { all: true, group: 'tools' });
    expect(readGroups().groups.tools.members).toHaveLength(3);

    await executeUninstall('obra/superpowers', { y: true });

    const groups = readGroups().groups;
    expect(groups.tools.members).toEqual([]);
    expect(groups.develop).toEqual({ kind: 'virtual', members: developMembers });
  });

  it('keeps the flat custom key for a local skill', async () => {
    const skillDir = join(testProjectDir, 'my-linter');
    writeSkillMd(skillDir, 'my-linter');

    await executeInstall('./my-linter', { group: 'python' });

    const installed = join(testManagerDir, 'custom', 'my-linter', 'SKILL.md');
    expect(existsSync(installed)).toBe(true);
    expect(readGroups().groups.python).toEqual({
      kind: 'virtual',
      members: ['custom/my-linter'],
    });
  });
});

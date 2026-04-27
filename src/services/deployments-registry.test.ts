import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { DeploymentsRegistryService } from './deployments-registry.js';

describe('DeploymentsRegistryService', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-deployments-registry-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('readRegistry returns empty when file missing', () => {
    const service = new DeploymentsRegistryService();
    expect(service.readRegistry()).toEqual({ version: '1.0', deployments: {} });
  });

  it('writeRegistry + readRegistry round trip', () => {
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        '/path/a': {
          mode: 'link',
          followGroups: ['tdd-spec'],
          pinnedSkills: ['custom/jt-codex'],
          lastDeployedAt: '2026-04-15T00:00:00.000Z',
        },
      },
    });
    const result = service.readRegistry();
    expect(result.deployments['/path/a'].followGroups).toEqual(['tdd-spec']);
  });

  it('readRegistry throws on invalid JSON', () => {
    writeFileSync(join(testManagerDir, 'deployments.json'), '{ not json');
    const service = new DeploymentsRegistryService();
    expect(() => service.readRegistry()).toThrow(/Invalid deployments registry/);
  });

  it('recordDeploy upserts entry with realpath normalization', () => {
    const realDir = join(tmpdir(), `skillsmgr-real-${Date.now()}`);
    const linkDir = join(tmpdir(), `skillsmgr-link-${Date.now()}`);
    mkdirSync(realDir);
    symlinkSync(realDir, linkDir);

    const service = new DeploymentsRegistryService();
    service.recordDeploy(realDir, {
      mode: 'link',
      followGroups: [],
      pinnedSkills: ['custom/a'],
      lastDeployedAt: '2026-04-15T00:00:00.000Z',
    });
    service.recordDeploy(linkDir, {
      mode: 'copy',
      followGroups: ['dev'],
      pinnedSkills: [],
      lastDeployedAt: '2026-04-15T01:00:00.000Z',
    });

    const result = service.readRegistry();
    expect(Object.keys(result.deployments)).toHaveLength(1);
    const entry = Object.values(result.deployments)[0];
    expect(entry.mode).toBe('copy');
    expect(entry.followGroups).toEqual(['dev']);

    rmSync(realDir, { recursive: true, force: true });
    rmSync(linkDir, { force: true });
  });

  it('remove deletes entry; missing path throws', () => {
    const realDir = join(tmpdir(), `skillsmgr-rmreg-${Date.now()}`);
    mkdirSync(realDir);
    const service = new DeploymentsRegistryService();
    service.recordDeploy(realDir, {
      mode: 'link',
      followGroups: [],
      pinnedSkills: [],
      lastDeployedAt: '',
    });
    service.remove(realDir);
    expect(service.readRegistry().deployments).toEqual({});
    expect(() => service.remove(realDir)).toThrow(/Path not found in registry/);
    rmSync(realDir, { recursive: true, force: true });
  });

  it('list sorts by path and includes exists flag', () => {
    const existing = join(tmpdir(), `skillsmgr-list-${Date.now()}`);
    mkdirSync(existing);
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        '/zzz': {
          mode: 'link',
          followGroups: [],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
        [existing]: {
          mode: 'link',
          followGroups: [],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
      },
    });
    const result = service.list();
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.path)).toEqual([...result.map((e) => e.path)].sort());
    const existingEntry = result.find((e) => e.path === existing);
    expect(existingEntry?.exists).toBe(true);
    const goneEntry = result.find((e) => e.path === '/zzz');
    expect(goneEntry?.exists).toBe(false);
    rmSync(existing, { recursive: true, force: true });
  });

  it('findAffectedByGroup buckets follow / pinned / missing', () => {
    const dirA = join(tmpdir(), `skillsmgr-aff-a-${Date.now()}`);
    const dirB = join(tmpdir(), `skillsmgr-aff-b-${Date.now()}`);
    mkdirSync(dirA);
    mkdirSync(dirB);
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        [dirA]: {
          mode: 'link',
          followGroups: ['tdd-spec'],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
        [dirB]: {
          mode: 'link',
          followGroups: [],
          pinnedSkills: ['custom/tdd-spec/ts-apply'],
          lastDeployedAt: '',
        },
        '/gone-project': {
          mode: 'link',
          followGroups: ['tdd-spec'],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
        '/unrelated': {
          mode: 'link',
          followGroups: ['other'],
          pinnedSkills: ['custom/other-skill'],
          lastDeployedAt: '',
        },
      },
    });

    const result = service.findAffectedByGroup('tdd-spec', [
      'custom/tdd-spec/ts-apply',
      'custom/tdd-spec/ts-archive',
    ]);

    expect(result.follow.map((e) => e.path)).toEqual([dirA]);
    expect(result.pinned.map((e) => e.path)).toEqual([dirB]);
    expect(result.missing.map((e) => e.path)).toEqual(['/gone-project']);

    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('pruneStale removes only missing entries', () => {
    const existing = join(tmpdir(), `skillsmgr-prune-${Date.now()}`);
    mkdirSync(existing);
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        '/gone-1': { mode: 'link', followGroups: [], pinnedSkills: [], lastDeployedAt: '' },
        '/gone-2': { mode: 'link', followGroups: [], pinnedSkills: [], lastDeployedAt: '' },
        [existing]: {
          mode: 'link',
          followGroups: [],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
      },
    });

    const removed = service.pruneStale();
    expect(removed.sort()).toEqual(['/gone-1', '/gone-2']);
    expect(Object.keys(service.readRegistry().deployments)).toEqual([existing]);

    rmSync(existing, { recursive: true, force: true });
  });

  it('pruneStale returns empty when nothing stale', () => {
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        [tmpdir()]: {
          mode: 'link',
          followGroups: [],
          pinnedSkills: [],
          lastDeployedAt: '',
        },
      },
    });
    expect(service.pruneStale()).toEqual([]);
  });

  it('legacy record without skillCompanions reads as empty list', () => {
    writeFileSync(
      join(testManagerDir, 'deployments.json'),
      JSON.stringify({
        version: '1.0',
        deployments: {
          '/legacy': {
            mode: 'link',
            followGroups: [],
            pinnedSkills: ['custom/x'],
            lastDeployedAt: '',
          },
        },
      }),
    );
    const service = new DeploymentsRegistryService();
    expect(service.getCompanionsForSkill('x', '/legacy')).toEqual([]);
  });

  it('addCompanion appends absolute path and persists', () => {
    const dir = join(tmpdir(), `smgr-comp-add-${Date.now()}`);
    mkdirSync(dir);
    const service = new DeploymentsRegistryService();
    service.addCompanion('jt-codex', dir, '/abs/.claude/agents/runner.md');
    service.addCompanion('jt-codex', dir, '/abs/.claude/agents/helper.md');
    expect(service.getCompanionsForSkill('jt-codex', dir)).toEqual([
      '/abs/.claude/agents/runner.md',
      '/abs/.claude/agents/helper.md',
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('addCompanion deduplicates same path', () => {
    const dir = join(tmpdir(), `smgr-comp-dedup-${Date.now()}`);
    mkdirSync(dir);
    const service = new DeploymentsRegistryService();
    service.addCompanion('s', dir, '/abs/x.md');
    service.addCompanion('s', dir, '/abs/x.md');
    expect(service.getCompanionsForSkill('s', dir)).toEqual(['/abs/x.md']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('clearCompanions removes per-skill record only', () => {
    const dir = join(tmpdir(), `smgr-comp-clear-${Date.now()}`);
    mkdirSync(dir);
    const service = new DeploymentsRegistryService();
    service.addCompanion('alpha', dir, '/abs/a.md');
    service.addCompanion('beta', dir, '/abs/b.md');
    service.clearCompanions('alpha', dir);
    expect(service.getCompanionsForSkill('alpha', dir)).toEqual([]);
    expect(service.getCompanionsForSkill('beta', dir)).toEqual(['/abs/b.md']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('listAllCompanionPaths flattens (skill, path) pairs', () => {
    const dir = join(tmpdir(), `smgr-comp-list-${Date.now()}`);
    mkdirSync(dir);
    const service = new DeploymentsRegistryService();
    service.addCompanion('a', dir, '/abs/1.md');
    service.addCompanion('a', dir, '/abs/2.md');
    service.addCompanion('b', dir, '/abs/3.md');
    const list = service.listAllCompanionPaths(dir);
    expect(list).toEqual(
      expect.arrayContaining([
        { skill: 'a', path: '/abs/1.md' },
        { skill: 'a', path: '/abs/2.md' },
        { skill: 'b', path: '/abs/3.md' },
      ]),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('JSON round-trip preserves skillCompanions', () => {
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        '/p': {
          mode: 'link',
          followGroups: [],
          pinnedSkills: [],
          lastDeployedAt: '',
          skillCompanions: {
            'x': { deployedCompanions: ['/abs/a.md'] },
          },
        },
      },
    });
    const r = service.readRegistry();
    expect(r.deployments['/p'].skillCompanions).toEqual({
      'x': { deployedCompanions: ['/abs/a.md'] },
    });
  });

  it('atomic write: file ends up with correct content', () => {
    const service = new DeploymentsRegistryService();
    service.writeRegistry({
      version: '1.0',
      deployments: {
        '/x': { mode: 'link', followGroups: [], pinnedSkills: [], lastDeployedAt: '' },
      },
    });
    const path = join(testManagerDir, 'deployments.json');
    const content = readFileSync(path, 'utf-8');
    expect(JSON.parse(content).deployments['/x']).toBeDefined();
  });
});

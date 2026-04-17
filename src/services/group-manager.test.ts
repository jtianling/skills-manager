import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as constants from '../constants.js';
import { GroupManager } from './group-manager.js';
import { GroupsService } from './groups.js';
import { SourcesService } from './sources.js';
import { promptConfirm } from '../utils/prompts.js';

vi.mock('../utils/prompts.js', async () => {
  const actual = await vi.importActual<typeof import('../utils/prompts.js')>('../utils/prompts.js');
  return {
    ...actual,
    promptConfirm: vi.fn().mockResolvedValue(true),
  };
});

function writeSkill(path: string, name: string, description = name): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n${description}`,
  );
}

describe('GroupManager', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-group-manager-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(promptConfirm).mockResolvedValue(true);
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('installs a local batch as a physical group', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-install-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha');
    writeSkill(join(sourceDir, 'beta'), 'beta');

    const result = await new GroupManager().installLocalBatch(sourceDir, { all: true });

    expect(result.groupName).toBe('spec-tdd');
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd', 'alpha', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd', 'beta', 'SKILL.md'))).toBe(true);
    expect(new GroupsService().getGroup('spec-tdd')).toMatchObject({
      kind: 'local-batch',
      url: sourceDir,
    });
    expect(new SourcesService().getSource('custom/spec-tdd/alpha')).toMatchObject({
      url: sourceDir,
      repoName: 'alpha',
    });

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('uninstalls a physical group using physical and recorded keys union', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-uninstall-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha');

    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'renamed'), 'renamed');

    const groupsService = new GroupsService();
    const sourcesService = new SourcesService();
    groupsService.createLocalBatchGroup('spec-tdd', sourceDir);
    groupsService.addSkill('tools', 'custom/spec-tdd/alpha');
    groupsService.addSkill('tools', 'custom/spec-tdd/old-name');

    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/spec-tdd/old-name', {
      url: sourceDir,
      type: 'custom',
      repoName: 'old-name',
      installMethod: 'local-copy',
    });

    const result = await new GroupManager().uninstallPhysicalGroup('spec-tdd', { force: true });

    expect(result.affectedKeys).toEqual([
      'custom/spec-tdd/alpha',
      'custom/spec-tdd/old-name',
      'custom/spec-tdd/renamed',
    ]);
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd'))).toBe(false);
    expect(sourcesService.getSource('custom/spec-tdd/alpha')).toBeUndefined();
    expect(sourcesService.getSource('custom/spec-tdd/old-name')).toBeUndefined();
    expect(groupsService.getGroup('spec-tdd')).toBeNull();
    expect(groupsService.getGroupMembers('tools')).toEqual([]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('updates a physical group by installing additions and removing orphaned skills', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-update-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha', 'new alpha');
    writeSkill(join(sourceDir, 'beta'), 'beta', 'beta');

    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha', 'old alpha');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'old-name'), 'old-name', 'old-name');

    const groupsService = new GroupsService();
    const sourcesService = new SourcesService();
    groupsService.createLocalBatchGroup('spec-tdd', sourceDir);
    groupsService.addSkill('tools', 'custom/spec-tdd/old-name');
    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/spec-tdd/old-name', {
      url: sourceDir,
      type: 'custom',
      repoName: 'old-name',
      installMethod: 'local-copy',
    });

    const result = await new GroupManager().updatePhysicalGroup('spec-tdd');

    expect(result).toMatchObject({
      updated: 1,
      added: 1,
      removed: 1,
      kept: 0,
      failed: 0,
    });
    expect(readFileSync(join(testManagerDir, 'custom', 'spec-tdd', 'alpha', 'SKILL.md'), 'utf-8'))
      .toContain('new alpha');
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd', 'beta', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd', 'old-name'))).toBe(false);
    expect(groupsService.getGroupMembers('tools')).toEqual([]);

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('keeps orphaned local skills when keepLocal is enabled', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-keep-${Date.now()}`, 'spec-tdd');
    writeSkill(join(sourceDir, 'alpha'), 'alpha');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'old-name'), 'old-name');

    const groupsService = new GroupsService();
    const sourcesService = new SourcesService();
    groupsService.createLocalBatchGroup('spec-tdd', sourceDir);
    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/spec-tdd/old-name', {
      url: sourceDir,
      type: 'custom',
      repoName: 'old-name',
      installMethod: 'local-copy',
    });

    const result = await new GroupManager().updatePhysicalGroup('spec-tdd', {
      keepLocal: true,
    });

    expect(result.kept).toBe(1);
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd', 'old-name', 'SKILL.md'))).toBe(true);
    expect(sourcesService.getSource('custom/spec-tdd/old-name')).toBeDefined();

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });

  it('renames a physical group across directory, sources and virtual references', () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-rename-${Date.now()}`, 'spec-tdd');
    writeSkill(join(testManagerDir, 'custom', 'spec-tdd', 'alpha'), 'alpha');

    const groupsService = new GroupsService();
    const sourcesService = new SourcesService();
    groupsService.createLocalBatchGroup('spec-tdd', sourceDir);
    groupsService.addSkill('tools', 'custom/spec-tdd/alpha');
    sourcesService.addSource('custom/spec-tdd/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });

    new GroupManager().renamePhysicalGroup('spec-tdd', 'tdd-suite');

    expect(existsSync(join(testManagerDir, 'custom', 'tdd-suite', 'alpha', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testManagerDir, 'custom', 'spec-tdd'))).toBe(false);
    expect(sourcesService.getSource('custom/spec-tdd/alpha')).toBeUndefined();
    expect(sourcesService.getSource('custom/tdd-suite/alpha')).toBeDefined();
    expect(groupsService.getGroup('spec-tdd')).toBeNull();
    expect(groupsService.getGroup('tdd-suite')).toMatchObject({
      kind: 'local-batch',
      url: sourceDir,
    });
    expect(groupsService.getGroupMembers('tools')).toEqual(['custom/tdd-suite/alpha']);
  });

  it('skips top-level local skills and dangling references in virtual groups', async () => {
    const originalDir = join(tmpdir(), `skillsmgr-group-virtual-${Date.now()}`, 'foo');
    writeSkill(originalDir, 'foo', 'updated foo');
    writeSkill(join(testManagerDir, 'custom', 'foo'), 'foo', 'old foo');

    const groupsService = new GroupsService();
    groupsService.addSkill('python', 'custom/foo');
    groupsService.addSkill('python', 'custom/missing');

    const result = await new GroupManager().updateVirtualGroup('python');

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(2);
    expect(readFileSync(join(testManagerDir, 'custom', 'foo', 'SKILL.md'), 'utf-8')).toContain(
      'old foo',
    );

    rmSync(join(originalDir, '..'), { recursive: true, force: true });
  });

  it('updates physical-group child members referenced by a virtual group', async () => {
    const sourceDir = join(tmpdir(), `skillsmgr-group-virtual-physical-${Date.now()}`, 'batch');
    writeSkill(join(sourceDir, 'alpha'), 'alpha', 'updated alpha');
    writeSkill(join(sourceDir, 'beta'), 'beta', 'beta');

    writeSkill(join(testManagerDir, 'custom', 'batch', 'alpha'), 'alpha', 'old alpha');
    writeSkill(join(testManagerDir, 'custom', 'batch', 'beta'), 'beta', 'beta');

    const groupsService = new GroupsService();
    const sourcesService = new SourcesService();
    groupsService.createLocalBatchGroup('batch', sourceDir);
    groupsService.addSkill('python', 'custom/batch/alpha');
    sourcesService.addSource('custom/batch/alpha', {
      url: sourceDir,
      type: 'custom',
      repoName: 'alpha',
      installMethod: 'local-copy',
    });
    sourcesService.addSource('custom/batch/beta', {
      url: sourceDir,
      type: 'custom',
      repoName: 'beta',
      installMethod: 'local-copy',
    });

    const result = await new GroupManager(
      sourcesService,
      groupsService,
    ).updateVirtualGroup('python');

    expect(result.updated).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
    expect(readFileSync(join(testManagerDir, 'custom', 'batch', 'alpha', 'SKILL.md'), 'utf-8'))
      .toContain('updated alpha');

    rmSync(join(sourceDir, '..'), { recursive: true, force: true });
  });
});

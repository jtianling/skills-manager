import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  GroupsService,
  isCollectionGroupKey,
  validateCollectionGroupKey,
  validateGroupName,
} from './groups.js';
import { SKILLS_MANAGER_DIR } from '../constants.js';

vi.mock('../constants.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants.js')>();
  const testDir = join(tmpdir(), `skillsmgr-groups-test-${process.pid}-${Date.now()}`);
  return { ...actual, SKILLS_MANAGER_DIR: testDir };
});

function createPhysicalSkill(groupName: string, skillName: string): void {
  const dir = join(SKILLS_MANAGER_DIR, 'custom', groupName, skillName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skillName}\n---\n`);
}

describe('GroupsService', () => {
  let service: GroupsService;

  beforeEach(() => {
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
    service = new GroupsService();
  });

  afterEach(() => {
    if (existsSync(SKILLS_MANAGER_DIR)) {
      rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('validateGroupName', () => {
    it('accepts valid names', () => {
      expect(() => validateGroupName('python')).not.toThrow();
      expect(() => validateGroupName('python-3')).not.toThrow();
      expect(() => validateGroupName('my_tools')).not.toThrow();
      expect(() => validateGroupName('A1')).not.toThrow();
    });

    it('rejects invalid names', () => {
      expect(() => validateGroupName('my tools')).toThrow();
      expect(() => validateGroupName('a/b')).toThrow();
      expect(() => validateGroupName('a.b')).toThrow();
    });
  });

  it('returns empty array when no groups.json exists', () => {
    expect(service.listGroups()).toEqual([]);
  });

  it('creates and reads virtual groups in V2 schema', () => {
    service.createGroup('python');
    service.addSkill('python', 'custom/my-linter');

    expect(service.getGroup('python')).toEqual({
      kind: 'virtual',
      members: ['custom/my-linter'],
    });
    expect(service.getGroupKind('python')).toBe('virtual');
    expect(service.getGroupMembers('python')).toEqual(['custom/my-linter']);
  });

  it('creates and reads local-batch groups', () => {
    createPhysicalSkill('tdd-spec', 'ts-apply');
    createPhysicalSkill('tdd-spec', 'ts-verify');

    service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');

    expect(service.getGroup('tdd-spec')).toMatchObject({
      kind: 'local-batch',
      url: '/dev/tdd-spec',
    });
    expect(service.getGroupKind('tdd-spec')).toBe('local-batch');
    expect(service.getGroupMembers('tdd-spec')).toEqual([
      'custom/tdd-spec/ts-apply',
      'custom/tdd-spec/ts-verify',
    ]);
  });

  it('createGroup rejects local-batch name conflicts', () => {
    service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');
    expect(() => service.createGroup('tdd-spec')).toThrow(
      "Group 'tdd-spec' already exists as a local-batch group (custom/tdd-spec/).",
    );
  });

  it('addSkill auto-creates virtual groups and is idempotent', () => {
    expect(service.addSkill('python', 'custom/my-linter')).toBe(true);
    expect(service.addSkill('python', 'custom/my-linter')).toBe(false);
    expect(service.getGroupMembers('python')).toEqual(['custom/my-linter']);
  });

  it('addSkill and removeSkill reject physical groups', () => {
    service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');

    expect(() => service.addSkill('tdd-spec', 'custom/tdd-spec/foo')).toThrow(
      "Cannot add to physical group 'tdd-spec'. Members of physical groups are derived from custom/tdd-spec/.",
    );
    expect(() => service.removeSkill('tdd-spec', 'custom/tdd-spec/foo')).toThrow(
      "Cannot modify physical group 'tdd-spec'. Members of physical groups are derived from custom/tdd-spec/.",
    );
  });

  it('removeSkillFromAll only affects virtual groups', () => {
    createPhysicalSkill('tdd-spec', 'ts-apply');
    service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');
    service.addSkill('python', 'custom/tdd-spec/ts-apply');
    service.addSkill('python', 'official/anthropic/skills/commit');

    service.removeSkillFromAll('custom/tdd-spec/ts-apply');

    expect(service.getGroupMembers('python')).toEqual(['official/anthropic/skills/commit']);
    expect(service.getGroupMembers('tdd-spec')).toEqual(['custom/tdd-spec/ts-apply']);
  });

  it('renames groups and preserves entry kind', () => {
    service.addSkill('python', 'custom/my-linter');
    service.renameGroup('python', 'py-tools');

    expect(service.getGroup('python')).toBeNull();
    expect(service.getGroup('py-tools')).toEqual({
      kind: 'virtual',
      members: ['custom/my-linter'],
    });
  });

  it('updates physical group timestamps and source url', () => {
    service.createLocalBatchGroup('tdd-spec', '/old/path/tdd-spec');
    const before = service.getGroup('tdd-spec');
    expect(before).not.toBeNull();

    service.setPhysicalGroupSourceUrl('tdd-spec', '/new/path/tdd-spec');
    service.updatePhysicalGroupTimestamp('tdd-spec');

    const after = service.getGroup('tdd-spec');
    expect(after).toMatchObject({
      kind: 'local-batch',
      url: '/new/path/tdd-spec',
    });
    expect(
      new Date((after as { updatedAt: string }).updatedAt).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date((before as { updatedAt: string }).updatedAt).getTime(),
    );
  });

  it('migrates V1 groups.json to V2 and writes backup', () => {
    const file = join(SKILLS_MANAGER_DIR, 'groups.json');
    writeFileSync(file, JSON.stringify({ python: ['custom/foo'] }, null, 2));

    const freshService = new GroupsService();

    expect(freshService.getGroup('python')).toEqual({
      kind: 'virtual',
      members: ['custom/foo'],
    });
    expect(readFileSync(join(SKILLS_MANAGER_DIR, 'groups.json.v1.backup'), 'utf-8')).toContain(
      '"python"',
    );
  });

  it('migrates local-batch bundles and renames conflicting virtual groups to legacy names', () => {
    service.addSkill('tdd-spec', 'official/anthropic/skills/commit');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const renamed = service.migrateLocalBatchToPhysicalGroup('tdd-spec', {
      type: 'local-batch',
      url: '/dev/tdd-spec',
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    expect(renamed).toBe('tdd-spec');
    expect(service.getGroup('tdd-spec')).toEqual({
      kind: 'local-batch',
      url: '/dev/tdd-spec',
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    expect(service.getGroup('tdd-spec-legacy')).toEqual({
      kind: 'virtual',
      members: ['official/anthropic/skills/commit'],
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "  ⚠ Group naming conflict: virtual group 'tdd-spec' renamed to 'tdd-spec-legacy'",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '    (a physical group with the same name was migrated from local-batch bundle)',
    );
    expect(readFileSync(join(SKILLS_MANAGER_DIR, 'migration.log'), 'utf-8')).toContain(
      'tdd-spec-legacy',
    );
  });

  it('increments legacy suffix when needed during migration', () => {
    service.addSkill('tdd-spec', 'official/anthropic/skills/commit');
    service.createGroup('tdd-spec-legacy');

    service.migrateLocalBatchToPhysicalGroup('tdd-spec', {
      type: 'local-batch',
      url: '/dev/tdd-spec',
      selectionMode: 'all',
      members: ['custom/tdd-spec/ts-apply'],
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    expect(service.getGroup('tdd-spec-legacy-2')).toEqual({
      kind: 'virtual',
      members: ['official/anthropic/skills/commit'],
    });
  });

  it('conservatively renames matching virtual groups during migration', () => {
    service.addSkill('tdd-spec', 'custom/tdd-spec/a');
    service.addSkill('tdd-spec', 'custom/tdd-spec/b');

    service.migrateLocalBatchToPhysicalGroup('tdd-spec', {
      type: 'local-batch',
      url: '/dev/tdd-spec',
      selectionMode: 'all',
      members: ['custom/tdd-spec/a', 'custom/tdd-spec/b'],
      installedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });

    expect(service.getGroup('tdd-spec')).toMatchObject({
      kind: 'local-batch',
      url: '/dev/tdd-spec',
    });
    expect(service.getGroup('tdd-spec-legacy')).toEqual({
      kind: 'virtual',
      members: ['custom/tdd-spec/a', 'custom/tdd-spec/b'],
    });
  });

  it('persists groups.json in V2 shape', () => {
    service.addSkill('python', 'custom/my-linter');
    service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');

    const content = JSON.parse(readFileSync(join(SKILLS_MANAGER_DIR, 'groups.json'), 'utf-8'));
    expect(content).toEqual({
      version: '2.0',
      groups: {
        python: {
          kind: 'virtual',
          members: ['custom/my-linter'],
        },
        'tdd-spec': {
          kind: 'local-batch',
          url: '/dev/tdd-spec',
          installedAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });
  });
});

describe('collection group keys', () => {
  it('isCollectionGroupKey accepts @owner/slug', () => {
    expect(isCollectionGroupKey('@alice/kit')).toBe(true);
  });

  it('isCollectionGroupKey rejects bare names', () => {
    expect(isCollectionGroupKey('alice/kit')).toBe(false);
    expect(isCollectionGroupKey('my-tools')).toBe(false);
  });

  it('isCollectionGroupKey rejects malformed scoped', () => {
    expect(isCollectionGroupKey('@alice')).toBe(false);
    expect(isCollectionGroupKey('@/kit')).toBe(false);
    expect(isCollectionGroupKey('@alice/kit/extra')).toBe(false);
  });

  it('validateCollectionGroupKey throws on invalid', () => {
    expect(() => validateCollectionGroupKey('alice/kit')).toThrow('Invalid collection group key');
  });

  it('validateCollectionGroupKey accepts valid', () => {
    expect(() => validateCollectionGroupKey('@alice/kit')).not.toThrow();
  });
});

describe('GroupsService collection groups', () => {
  let service: GroupsService;

  beforeEach(() => {
    mkdirSync(SKILLS_MANAGER_DIR, { recursive: true });
    service = new GroupsService();
  });

  afterEach(() => {
    rmSync(SKILLS_MANAGER_DIR, { recursive: true, force: true });
  });

  it('upsertCollectionGroup creates a new entry', () => {
    const result = service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a', 'registry/@alice/b']);
    expect(result.created).toBe(true);

    const group = service.getCollectionGroup('@alice/kit');
    expect(group).not.toBeNull();
    expect(group!.kind).toBe('collection');
    expect(group!.ref).toBe('@alice/kit');
    expect(group!.members).toEqual(['registry/@alice/a', 'registry/@alice/b']);
    expect(group!.installedAt).toBeTruthy();
    expect(group!.updatedAt).toBeTruthy();
  });

  it('upsertCollectionGroup keeps installedAt on second call', async () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
    const first = service.getCollectionGroup('@alice/kit')!;
    await new Promise((r) => setTimeout(r, 5));
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a', 'registry/@alice/b']);
    const second = service.getCollectionGroup('@alice/kit')!;

    expect(second.installedAt).toBe(first.installedAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.members).toHaveLength(2);
  });

  it('upsertCollectionGroup rejects malformed key', () => {
    expect(() => service.upsertCollectionGroup('alice/kit', [])).toThrow('Invalid collection group key');
  });

  it('upsertCollectionGroup rejects existing non-collection key', () => {
    service.createGroup('mykit');
    expect(() => service.upsertCollectionGroup('mykit', [])).toThrow();
  });

  it('removeCollectionGroup removes the entry', () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
    expect(service.removeCollectionGroup('@alice/kit')).toBe(true);
    expect(service.getCollectionGroup('@alice/kit')).toBeNull();
  });

  it('removeCollectionGroup returns false when not present', () => {
    expect(service.removeCollectionGroup('@bob/missing')).toBe(false);
  });

  it('addSkill rejects collection group keys', () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
    expect(() => service.addSkill('@alice/kit', 'registry/@alice/c')).toThrow(
      'Cannot manually modify collection group',
    );
  });

  it('removeSkill rejects collection group keys', () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
    expect(() => service.removeSkill('@alice/kit', 'registry/@alice/a')).toThrow(
      'Cannot manually modify collection group',
    );
  });

  it('getGroupMembers returns collection members', () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a', 'registry/@alice/b']);
    expect(service.getGroupMembers('@alice/kit')).toEqual(['registry/@alice/a', 'registry/@alice/b']);
  });

  it('setCollectionGroupMembers replaces snapshot and updates updatedAt', async () => {
    service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
    const before = service.getCollectionGroup('@alice/kit')!;
    await new Promise((r) => setTimeout(r, 5));
    service.setCollectionGroupMembers('@alice/kit', ['registry/@alice/x', 'registry/@alice/y']);
    const after = service.getCollectionGroup('@alice/kit')!;

    expect(after.members).toEqual(['registry/@alice/x', 'registry/@alice/y']);
    expect(after.installedAt).toBe(before.installedAt);
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  describe('group references', () => {
    it('addSkill rejects group: prefixed keys', () => {
      service.createGroup('python');
      expect(() => service.addSkill('python', 'group:develop')).toThrow(
        /group reference operation/,
      );
    });

    it('addSkill still accepts normal skill keys', () => {
      service.createGroup('python');
      expect(service.addSkill('python', 'custom/foo')).toBe(true);
      expect(service.getGroup('python')).toEqual({
        kind: 'virtual',
        members: ['custom/foo'],
      });
    });

    it('addGroupRef writes a group: reference and auto-creates target', () => {
      expect(service.addGroupRef('vercel-develop', 'develop')).toBe(true);
      expect(service.getGroup('vercel-develop')).toEqual({
        kind: 'virtual',
        members: ['group:develop'],
      });
    });

    it('addGroupRef is idempotent', () => {
      service.addGroupRef('vercel-develop', 'develop');
      expect(service.addGroupRef('vercel-develop', 'develop')).toBe(false);
      expect(service.getGroup('vercel-develop')).toEqual({
        kind: 'virtual',
        members: ['group:develop'],
      });
    });

    it('addGroupRef rejects self-reference', () => {
      expect(() => service.addGroupRef('develop', 'develop')).toThrow(
        'Cannot reference a group from itself.',
      );
    });

    it('addGroupRef rejects local-batch target', () => {
      createPhysicalSkill('tdd-spec', 'ts-apply');
      service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');
      expect(() => service.addGroupRef('tdd-spec', 'develop')).toThrow(
        /Only virtual groups can hold group references/,
      );
    });

    it('addGroupRef rejects collection target', () => {
      service.upsertCollectionGroup('@alice/kit', ['registry/@alice/a']);
      expect(() => service.addGroupRef('@alice/kit', 'develop')).toThrow();
    });

    it('addGroupRef preserves existing members immutably', () => {
      service.createGroup('vercel-develop');
      service.addSkill('vercel-develop', 'custom/logger');
      service.addGroupRef('vercel-develop', 'develop');
      expect(service.getGroup('vercel-develop')).toEqual({
        kind: 'virtual',
        members: ['custom/logger', 'group:develop'],
      });
    });

    it('removeGroupRef removes a reference', () => {
      service.addGroupRef('vercel-develop', 'develop');
      expect(service.removeGroupRef('vercel-develop', 'develop')).toBe(true);
      expect(service.getGroup('vercel-develop')).toEqual({
        kind: 'virtual',
        members: [],
      });
    });

    it('removeGroupRef returns false when reference absent', () => {
      service.createGroup('vercel-develop');
      expect(service.removeGroupRef('vercel-develop', 'develop')).toBe(false);
    });

    it('removeGroupRef returns false when target missing', () => {
      expect(service.removeGroupRef('nosuch', 'develop')).toBe(false);
    });
  });

  describe('getGroupMembers recursive expansion', () => {
    it('expands a single-level reference and preserves order', () => {
      service.createGroup('develop');
      service.addSkill('develop', 'custom/a');
      service.addSkill('develop', 'custom/b');
      service.addGroupRef('vercel-develop', 'develop');
      service.addSkill('vercel-develop', 'custom/c');

      expect(service.getGroupMembers('vercel-develop')).toEqual([
        'custom/a',
        'custom/b',
        'custom/c',
      ]);
    });

    it('dynamically follows changes in the referenced group', () => {
      service.createGroup('develop');
      service.addSkill('develop', 'custom/a');
      service.addGroupRef('vercel-develop', 'develop');

      service.addSkill('develop', 'custom/x');
      expect(service.getGroupMembers('vercel-develop')).toContain('custom/x');
    });

    it('expands multi-level nested references', () => {
      service.createGroup('a');
      service.addSkill('a', 'custom/a');
      service.addGroupRef('b', 'a');
      service.addGroupRef('c', 'b');

      expect(service.getGroupMembers('c')).toEqual(['custom/a']);
    });

    it('terminates safely on cyclic references', () => {
      service.createGroup('a');
      service.addSkill('a', 'custom/a');
      service.addGroupRef('a', 'b');
      service.createGroup('b');
      service.addSkill('b', 'custom/b');
      service.addGroupRef('b', 'a');

      expect(service.getGroupMembers('a')).toEqual(['custom/a', 'custom/b']);
    });

    it('dedups skills reachable via multiple paths (first-seen order)', () => {
      service.createGroup('a');
      service.addSkill('a', 'custom/shared');
      service.createGroup('b');
      service.addSkill('b', 'custom/shared');
      service.addGroupRef('x', 'a');
      service.addGroupRef('x', 'b');

      expect(service.getGroupMembers('x')).toEqual(['custom/shared']);
    });

    it('silently skips dangling references', () => {
      service.createGroup('x');
      service.addGroupRef('x', 'gone');
      service.addSkill('x', 'custom/a');

      expect(service.getGroupMembers('x')).toEqual(['custom/a']);
    });

    it('expands a referenced physical group to its derived members', () => {
      createPhysicalSkill('tdd-spec', 'ts-apply');
      createPhysicalSkill('tdd-spec', 'ts-verify');
      service.createLocalBatchGroup('tdd-spec', '/dev/tdd-spec');
      service.addGroupRef('x', 'tdd-spec');

      expect(service.getGroupMembers('x')).toEqual([
        'custom/tdd-spec/ts-apply',
        'custom/tdd-spec/ts-verify',
      ]);
    });
  });
});

import { renameSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import type { Bundle, GroupEntry, GroupKind, GroupsDataV2 } from '../types.js';
import { logMigrationLines } from './migration-logger.js';
import {
  ensureDir,
  fileExists,
  getDirectoriesInDir,
  readFileContent,
  writeFile,
} from '../utils/fs.js';

type GroupsDataV1 = Record<string, string[]>;

function getGroupsFile(): string {
  return join(SKILLS_MANAGER_DIR, 'groups.json');
}

function getPhysicalGroupDir(name: string): string {
  return join(SKILLS_MANAGER_DIR, 'custom', name);
}

function isGroupsDataV2(data: unknown): data is GroupsDataV2 {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<GroupsDataV2>;
  return candidate.version === '2.0' && candidate.groups !== undefined;
}

function atomicWrite(path: string, content: string): void {
  const tempPath = `${path}.tmp`;
  ensureDir(dirname(path));

  try {
    writeFile(tempPath, content);
    renameSync(tempPath, path);
  } catch (error) {
    if (fileExists(tempPath)) {
      rmSync(tempPath, { force: true });
    }
    throw error;
  }
}

export function validateGroupName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Group name must contain only letters, numbers, hyphens, and underscores');
  }
}

export class GroupsService {
  private load(): GroupsDataV2 {
    const file = getGroupsFile();
    if (!fileExists(file)) {
      return { version: '2.0', groups: {} };
    }

    const raw = readFileContent(file);
    const parsed = JSON.parse(raw) as GroupsDataV1 | GroupsDataV2;

    if (isGroupsDataV2(parsed)) {
      return {
        version: '2.0',
        groups: parsed.groups ?? {},
      };
    }

    const migrated = this.migrateV1ToV2(parsed);

    try {
      this.writeBackup(raw, 'v1.backup');
      this.save(migrated);
    } catch {
      return migrated;
    }

    logMigrationLines([
      `  ✓ groups.json V1 → V2: ${Object.keys(migrated.groups).length} groups upgraded`,
    ]);

    return migrated;
  }

  private save(data: GroupsDataV2): void {
    atomicWrite(getGroupsFile(), JSON.stringify(data, null, 2));
  }

  private writeBackup(content: string, suffix: string): void {
    atomicWrite(`${getGroupsFile()}.${suffix}`, content);
  }

  private migrateV1ToV2(data: GroupsDataV1): GroupsDataV2 {
    const groups = Object.entries(data).reduce<Record<string, GroupEntry>>(
      (acc, [name, members]) => ({
        ...acc,
        [name]: {
          kind: 'virtual',
          members: [...members],
        },
      }),
      {},
    );

    return {
      version: '2.0',
      groups,
    };
  }

  private assertGroupExists(data: GroupsDataV2, name: string): GroupEntry {
    const group = data.groups[name];
    if (!group) {
      throw new Error(`Group '${name}' not found.`);
    }
    return group;
  }

  private assertVirtualGroup(
    data: GroupsDataV2,
    name: string,
  ): Extract<GroupEntry, { kind: 'virtual' }> {
    const group = this.assertGroupExists(data, name);
    if (group.kind !== 'virtual') {
      throw new Error(
        `Cannot modify physical group '${name}'. Members of physical groups are derived from custom/${name}/.`,
      );
    }
    return group;
  }

  private createPhysicalGroupEntry(name: string, url: string, now: string): GroupEntry {
    return {
      kind: 'local-batch',
      url,
      installedAt: now,
      updatedAt: now,
    };
  }

  private getNextLegacyName(data: GroupsDataV2, name: string): string {
    let candidate = `${name}-legacy`;
    let i = 2;
    while (data.groups[candidate]) {
      candidate = `${name}-legacy-${i++}`;
    }
    return candidate;
  }

  listGroups(): string[] {
    return Object.keys(this.load().groups).sort((a, b) => a.localeCompare(b));
  }

  getGroup(name: string): GroupEntry | null {
    return this.load().groups[name] ?? null;
  }

  getGroupKind(name: string): GroupKind | null {
    return this.getGroup(name)?.kind ?? null;
  }

  getGroupMembers(name: string): string[] {
    const group = this.getGroup(name);
    if (!group) {
      return [];
    }

    if (group.kind === 'virtual') {
      return [...group.members];
    }

    return getDirectoriesInDir(getPhysicalGroupDir(name))
      .filter((entry) => fileExists(join(entry.path, 'SKILL.md')))
      .map((entry) => `custom/${name}/${entry.name}`);
  }

  createGroup(name: string): void {
    validateGroupName(name);
    const data = this.load();
    const existing = data.groups[name];

    if (existing?.kind === 'local-batch') {
      throw new Error(
        `Group '${name}' already exists as a local-batch group (custom/${name}/).`,
      );
    }
    if (existing) {
      throw new Error(`Group '${name}' already exists.`);
    }

    this.save({
      ...data,
      groups: {
        ...data.groups,
        [name]: {
          kind: 'virtual',
          members: [],
        },
      },
    });
  }

  createLocalBatchGroup(name: string, url: string): void {
    validateGroupName(name);
    const data = this.load();
    if (data.groups[name]) {
      throw new Error(`Group '${name}' already exists.`);
    }

    const now = new Date().toISOString();
    this.save({
      ...data,
      groups: {
        ...data.groups,
        [name]: this.createPhysicalGroupEntry(name, url, now),
      },
    });
  }

  migrateLocalBatchToPhysicalGroup(name: string, bundle: Bundle): string {
    validateGroupName(name);
    const data = this.load();
    const existing = data.groups[name];
    const now = new Date().toISOString();

    if (!existing) {
      this.save({
        ...data,
        groups: {
          ...data.groups,
          [name]: {
            kind: 'local-batch',
            url: bundle.url,
            installedAt: bundle.installedAt,
            updatedAt: bundle.updatedAt,
          },
        },
      });
      return name;
    }

    if (existing.kind === 'local-batch') {
      if (existing.url !== bundle.url) {
        throw new Error(
          `Physical group '${name}' already exists with a different url: ${existing.url}`,
        );
      }
      return name;
    }

    const groups = { ...data.groups };

    const legacyName = this.getNextLegacyName(data, name);
    delete groups[name];
    groups[legacyName] = {
      kind: 'virtual',
      members: [...existing.members],
    };
    logMigrationLines([
      `  ⚠ Group naming conflict: virtual group '${name}' renamed to '${legacyName}'`,
      '    (a physical group with the same name was migrated from local-batch bundle)',
    ]);

    groups[name] = {
      kind: 'local-batch',
      url: bundle.url,
      installedAt: bundle.installedAt ?? now,
      updatedAt: bundle.updatedAt ?? now,
    };

    this.save({
      ...data,
      groups,
    });
    return name;
  }

  deleteGroup(name: string): void {
    const data = this.load();
    const group = this.assertGroupExists(data, name);
    if (group.kind !== 'virtual') {
      throw new Error(
        `Group '${name}' is a local-batch group. Use 'group uninstall ${name}' instead.`,
      );
    }

    const { [name]: _removed, ...groups } = data.groups;
    this.save({
      ...data,
      groups,
    });
  }

  deletePhysicalGroup(name: string): void {
    const data = this.load();
    const group = this.assertGroupExists(data, name);
    if (group.kind !== 'local-batch') {
      throw new Error(`Group '${name}' is not a local-batch group.`);
    }

    const { [name]: _removed, ...groups } = data.groups;
    this.save({
      ...data,
      groups,
    });
  }

  renameGroup(oldName: string, newName: string): void {
    validateGroupName(newName);
    const data = this.load();
    const group = this.assertGroupExists(data, oldName);
    if (group.kind !== 'virtual') {
      throw new Error(
        `Group '${oldName}' is a local-batch group. Use 'group rename ${oldName} ${newName}' via the physical group workflow.`,
      );
    }

    if (oldName === newName) {
      throw new Error('New name is the same as the current name.');
    }
    if (data.groups[newName]) {
      throw new Error(`Group '${newName}' already exists.`);
    }

    const { [oldName]: _oldGroup, ...remaining } = data.groups;
    this.save({
      ...data,
      groups: {
        ...remaining,
        [newName]: { kind: 'virtual', members: [...group.members] },
      },
    });
  }

  updatePhysicalGroupTimestamp(name: string): void {
    const data = this.load();
    const group = this.assertGroupExists(data, name);
    if (group.kind !== 'local-batch') {
      throw new Error(`Group '${name}' is not a local-batch group.`);
    }

    this.save({
      ...data,
      groups: {
        ...data.groups,
        [name]: {
          ...group,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  setPhysicalGroupSourceUrl(name: string, url: string): void {
    const data = this.load();
    const group = this.assertGroupExists(data, name);
    if (group.kind !== 'local-batch') {
      throw new Error(`Group '${name}' is not a local-batch group.`);
    }

    this.save({
      ...data,
      groups: {
        ...data.groups,
        [name]: {
          ...group,
          url,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  addSkill(group: string, skillKey: string): boolean {
    validateGroupName(group);
    const data = this.load();
    const existing = data.groups[group];

    if (existing?.kind === 'local-batch') {
      throw new Error(
        `Cannot add to physical group '${group}'. Members of physical groups are derived from custom/${group}/.`,
      );
    }

    const members = existing ? existing.members : [];
    if (members.includes(skillKey)) {
      return false;
    }

    this.save({
      ...data,
      groups: {
        ...data.groups,
        [group]: {
          kind: 'virtual',
          members: [...members, skillKey],
        },
      },
    });
    return true;
  }

  removeSkill(group: string, skillKey: string): boolean {
    const data = this.load();
    const existing = data.groups[group];
    if (!existing) {
      return false;
    }
    if (existing.kind !== 'virtual') {
      throw new Error(
        `Cannot modify physical group '${group}'. Members of physical groups are derived from custom/${group}/.`,
      );
    }

    const nextMembers = existing.members.filter((member) => member !== skillKey);
    if (nextMembers.length === existing.members.length) {
      return false;
    }

    this.save({
      ...data,
      groups: {
        ...data.groups,
        [group]: {
          kind: 'virtual',
          members: nextMembers,
        },
      },
    });
    return true;
  }

  removeSkillFromAll(skillKey: string): void {
    const data = this.load();
    let changed = false;
    const groups = Object.entries(data.groups).reduce<Record<string, GroupEntry>>(
      (acc, [name, group]) => {
        if (group.kind !== 'virtual') {
          return {
            ...acc,
            [name]: group,
          };
        }

        const nextMembers = group.members.filter((member) => member !== skillKey);
        if (nextMembers.length !== group.members.length) {
          changed = true;
        }

        return {
          ...acc,
          [name]: {
            kind: 'virtual',
            members: nextMembers,
          },
        };
      },
      {},
    );

    if (!changed) {
      return;
    }

    this.save({
      ...data,
      groups,
    });
  }

  findPhysicalGroupsByBasename(
    basename: string,
  ): Array<{ name: string; group: Extract<GroupEntry, { kind: 'local-batch' }> }> {
    return Object.entries(this.load().groups).flatMap(([name, group]) => {
      if (group.kind !== 'local-batch' || nameOfGroup(group.url) !== basename) {
        return [];
      }

      return [{ name, group }];
    });
  }

  renamePhysicalGroupEntry(oldName: string, newName: string): void {
    const data = this.load();
    const group = this.assertGroupExists(data, oldName);
    if (group.kind !== 'local-batch') {
      throw new Error(`Group '${oldName}' is not a local-batch group.`);
    }
    if (data.groups[newName]) {
      throw new Error(`Group '${newName}' already exists.`);
    }

    const { [oldName]: _oldGroup, ...remaining } = data.groups;
    this.save({
      ...data,
      groups: {
        ...remaining,
        [newName]: {
          ...group,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  renameVirtualGroupMemberPrefix(oldPrefix: string, newPrefix: string): void {
    const data = this.load();
    let changed = false;
    const groups = Object.entries(data.groups).reduce<Record<string, GroupEntry>>(
      (acc, [name, group]) => {
        if (group.kind !== 'virtual') {
          return {
            ...acc,
            [name]: group,
          };
        }

        const members = group.members.map((member) => {
          if (!member.startsWith(oldPrefix)) {
            return member;
          }
          changed = true;
          return `${newPrefix}${member.slice(oldPrefix.length)}`;
        });

        return {
          ...acc,
          [name]: {
            kind: 'virtual',
            members,
          },
        };
      },
      {},
    );

    if (!changed) {
      return;
    }

    this.save({
      ...data,
      groups,
    });
  }
}

function nameOfGroup(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1] ?? normalized;
}

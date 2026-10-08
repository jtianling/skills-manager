import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface VirtualGroup {
  kind: 'virtual';
  members: string[];
}

export interface LocalBatchGroup {
  kind: 'local-batch';
  url: string;
  installedAt: string;
  updatedAt: string;
}

export type GroupEntry = VirtualGroup | LocalBatchGroup | { kind: string; [k: string]: unknown };

export interface GroupsDataV2 {
  version: string;
  groups: Record<string, GroupEntry>;
}

function groupsPath(homeDir: string): string {
  return join(homeDir, '.skills-manager', 'groups.json');
}

/** Read the V2 envelope. Absent file reads as an empty V2 document. */
export function readGroupsData(homeDir: string): GroupsDataV2 {
  const path = groupsPath(homeDir);
  if (!existsSync(path)) return { version: '2.0', groups: {} };
  return JSON.parse(readFileSync(path, 'utf-8')) as GroupsDataV2;
}

/** Group name → entry, without the version envelope. */
export function readGroups(homeDir: string): Record<string, GroupEntry> {
  return readGroupsData(homeDir).groups ?? {};
}

export function groupNames(homeDir: string): string[] {
  return Object.keys(readGroups(homeDir));
}

export function hasGroup(homeDir: string, name: string): boolean {
  return name in readGroups(homeDir);
}

/**
 * Members of a virtual group. A missing group and a physical group both
 * read as [], so callers assert on membership rather than on shape.
 */
export function groupMembers(homeDir: string, name: string): string[] {
  const entry = readGroups(homeDir)[name];
  if (!entry || !('members' in entry)) return [];
  return (entry.members as string[]) ?? [];
}

/** 'virtual' | 'local-batch' | 'collection', or undefined when absent. */
export function groupKind(homeDir: string, name: string): string | undefined {
  return readGroups(homeDir)[name]?.kind;
}

/**
 * Group name → members, flattening the V2 entry shape. Physical groups
 * derive members from disk and read as [].
 */
export function groupMembersMap(homeDir: string): Record<string, string[]> {
  const entries = Object.entries(readGroups(homeDir)).map(
    ([name, entry]) =>
      [name, 'members' in entry ? ((entry.members as string[]) ?? []) : []] as const,
  );
  return Object.fromEntries(entries);
}

/**
 * Skill keys a physical group covers. They are derived from
 * custom/<name>/ on disk rather than stored in groups.json.
 */
export function installedSkillKeys(homeDir: string, name: string): string[] {
  const dir = join(homeDir, '.skills-manager', 'custom', name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => `custom/${name}/${e.name}`)
    .sort();
}

/** Seed groups.json in V2 form from a plain name → members map. */
export function writeVirtualGroups(
  homeDir: string,
  groups: Record<string, string[]>,
): void {
  const dir = join(homeDir, '.skills-manager');
  mkdirSync(dir, { recursive: true });
  const entries = Object.entries(groups).map(
    ([name, members]) => [name, { kind: 'virtual', members }] as const,
  );
  const data: GroupsDataV2 = {
    version: '2.0',
    groups: Object.fromEntries(entries),
  };
  writeFileSync(groupsPath(homeDir), JSON.stringify(data, null, 2));
}

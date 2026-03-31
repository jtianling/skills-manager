import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { fileExists, readFileContent, writeFile } from '../utils/fs.js';

type GroupsData = Record<string, string[]>;

function getGroupsFile(): string {
  return join(SKILLS_MANAGER_DIR, 'groups.json');
}

export function validateGroupName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Group name must contain only letters, numbers, hyphens, and underscores');
  }
}

export class GroupsService {
  private load(): GroupsData {
    const file = getGroupsFile();
    if (!fileExists(file)) {
      return {};
    }
    return JSON.parse(readFileContent(file)) as GroupsData;
  }

  private save(data: GroupsData): void {
    writeFile(getGroupsFile(), JSON.stringify(data, null, 2));
  }

  listGroups(): string[] {
    return Object.keys(this.load());
  }

  getGroup(name: string): string[] | null {
    const data = this.load();
    return data[name] ?? null;
  }

  createGroup(name: string): void {
    validateGroupName(name);
    const data = this.load();
    if (data[name]) {
      throw new Error(`Group '${name}' already exists.`);
    }
    data[name] = [];
    this.save(data);
  }

  deleteGroup(name: string): void {
    const data = this.load();
    if (!data[name]) {
      throw new Error(`Group '${name}' not found.`);
    }
    delete data[name];
    this.save(data);
  }

  renameGroup(oldName: string, newName: string): void {
    validateGroupName(newName);
    const data = this.load();
    const group = data[oldName];

    if (!group) {
      throw new Error(`Group '${oldName}' not found.`);
    }
    if (oldName === newName) {
      throw new Error('New name is the same as the current name.');
    }
    if (data[newName]) {
      throw new Error(`Group '${newName}' already exists.`);
    }

    const { [oldName]: _oldGroup, ...remaining } = data;
    this.save({
      ...remaining,
      [newName]: group,
    });
  }

  addSkill(group: string, skillKey: string): boolean {
    validateGroupName(group);
    const data = this.load();
    if (!data[group]) {
      data[group] = [];
    }
    if (data[group].includes(skillKey)) {
      return false;
    }
    data[group].push(skillKey);
    this.save(data);
    return true;
  }

  removeSkill(group: string, skillKey: string): boolean {
    const data = this.load();
    if (!data[group]) {
      return false;
    }
    const idx = data[group].indexOf(skillKey);
    if (idx === -1) {
      return false;
    }
    data[group].splice(idx, 1);
    this.save(data);
    return true;
  }

  removeSkillFromAll(skillKey: string): void {
    const data = this.load();
    let changed = false;
    for (const group of Object.keys(data)) {
      const idx = data[group].indexOf(skillKey);
      if (idx !== -1) {
        data[group].splice(idx, 1);
        changed = true;
      }
    }
    if (changed) {
      this.save(data);
    }
  }
}

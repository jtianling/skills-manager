import { dirname, join } from 'path';
import { existsSync, mkdirSync, realpathSync, renameSync, writeFileSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { fileExists, readFileContent } from '../utils/fs.js';

export interface SkillCompanionsRecord {
  deployedCompanions: string[];
}

export interface DeploymentEntry {
  mode: 'link' | 'copy';
  followGroups: string[];
  pinnedSkills: string[];
  lastDeployedAt: string;
  skillCompanions?: Record<string, SkillCompanionsRecord>;
}

export interface DeploymentsRegistry {
  version: '1.0';
  deployments: Record<string, DeploymentEntry>;
}

export interface DeploymentEntryView extends DeploymentEntry {
  path: string;
  exists: boolean;
}

export interface AffectedProjects {
  follow: DeploymentEntryView[];
  pinned: DeploymentEntryView[];
  missing: DeploymentEntryView[];
}

const REGISTRY_FILE = 'deployments.json';

function getRegistryPath(): string {
  return join(SKILLS_MANAGER_DIR, REGISTRY_FILE);
}

function emptyRegistry(): DeploymentsRegistry {
  return { version: '1.0', deployments: {} };
}

function normalizePath(projectPath: string): string {
  try {
    return realpathSync(projectPath);
  } catch {
    return projectPath;
  }
}

function normalizeSkillCompanions(
  raw: unknown,
): Record<string, SkillCompanionsRecord> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, SkillCompanionsRecord> = {};
  for (const [skill, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const inner = value as Record<string, unknown>;
    const list = Array.isArray(inner.deployedCompanions)
      ? (inner.deployedCompanions as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : [];
    out[skill] = { deployedCompanions: list };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeEntry(raw: unknown): DeploymentEntry {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const skillCompanions = normalizeSkillCompanions(obj.skillCompanions);
  return {
    mode: obj.mode === 'copy' ? 'copy' : 'link',
    followGroups: Array.isArray(obj.followGroups)
      ? (obj.followGroups as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    pinnedSkills: Array.isArray(obj.pinnedSkills)
      ? (obj.pinnedSkills as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    lastDeployedAt: typeof obj.lastDeployedAt === 'string' ? obj.lastDeployedAt : '',
    ...(skillCompanions ? { skillCompanions } : {}),
  };
}

export class DeploymentsRegistryService {
  readRegistry(): DeploymentsRegistry {
    const path = getRegistryPath();
    if (!fileExists(path)) {
      return emptyRegistry();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileContent(path));
    } catch (e) {
      throw new Error(
        `Invalid deployments registry: ${path}.  Fix or delete the file to continue. (${(e as Error).message})`,
      );
    }
    const obj = (parsed ?? {}) as Record<string, unknown>;
    const deployments: Record<string, DeploymentEntry> = {};
    if (obj.deployments && typeof obj.deployments === 'object') {
      for (const [key, value] of Object.entries(obj.deployments as Record<string, unknown>)) {
        deployments[key] = normalizeEntry(value);
      }
    }
    return { version: '1.0', deployments };
  }

  writeRegistry(registry: DeploymentsRegistry): void {
    const path = getRegistryPath();
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
    renameSync(tmp, path);
  }

  recordDeploy(projectPath: string, entry: DeploymentEntry): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const previous = registry.deployments[key];
    const merged: DeploymentEntry = {
      ...entry,
      ...(previous?.skillCompanions && !entry.skillCompanions
        ? { skillCompanions: previous.skillCompanions }
        : {}),
    };
    registry.deployments[key] = merged;
    this.writeRegistry(registry);
  }

  remove(projectPath: string): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    if (!(key in registry.deployments)) {
      throw new Error(`Path not found in registry: ${key}`);
    }
    delete registry.deployments[key];
    this.writeRegistry(registry);
  }

  list(): DeploymentEntryView[] {
    const registry = this.readRegistry();
    return Object.entries(registry.deployments)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, entry]) => ({
        ...entry,
        path,
        exists: fileExists(path),
      }));
  }

  findAffectedByGroup(groupName: string, skillKeysOfGroup: string[]): AffectedProjects {
    const groupSkillKeys = new Set(skillKeysOfGroup);
    const entries = this.list();
    const result: AffectedProjects = { follow: [], pinned: [], missing: [] };

    for (const entry of entries) {
      const isFollowing = entry.followGroups.includes(groupName);
      const hasPinned = entry.pinnedSkills.some((key) => groupSkillKeys.has(key));

      if (!isFollowing && !hasPinned) {
        continue;
      }

      if (!entry.exists) {
        result.missing.push(entry);
        continue;
      }

      if (isFollowing) {
        result.follow.push(entry);
      } else {
        result.pinned.push(entry);
      }
    }

    return result;
  }

  pruneStale(): string[] {
    const registry = this.readRegistry();
    const removed: string[] = [];
    for (const path of Object.keys(registry.deployments)) {
      if (!fileExists(path)) {
        removed.push(path);
        delete registry.deployments[path];
      }
    }
    if (removed.length > 0) {
      this.writeRegistry(registry);
    }
    return removed;
  }

  getCompanionsForSkill(skill: string, projectPath: string): string[] {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const entry = registry.deployments[key];
    return entry?.skillCompanions?.[skill]?.deployedCompanions ?? [];
  }

  ensureSkillRecord(skill: string, projectPath: string): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const previous = registry.deployments[key] ?? {
      mode: 'link' as const,
      followGroups: [],
      pinnedSkills: [],
      lastDeployedAt: '',
    };
    const prevSkills = previous.skillCompanions ?? {};
    if (skill in prevSkills) return;
    const nextEntry: DeploymentEntry = {
      ...previous,
      skillCompanions: {
        ...prevSkills,
        [skill]: { deployedCompanions: [] },
      },
    };
    registry.deployments[key] = nextEntry;
    this.writeRegistry(registry);
  }

  addCompanion(skill: string, projectPath: string, absPath: string): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const previous = registry.deployments[key] ?? {
      mode: 'link' as const,
      followGroups: [],
      pinnedSkills: [],
      lastDeployedAt: '',
    };
    const prevSkills = previous.skillCompanions ?? {};
    const prevList = prevSkills[skill]?.deployedCompanions ?? [];
    const nextList = prevList.includes(absPath) ? prevList : [...prevList, absPath];
    const nextEntry: DeploymentEntry = {
      ...previous,
      skillCompanions: {
        ...prevSkills,
        [skill]: { deployedCompanions: nextList },
      },
    };
    registry.deployments[key] = nextEntry;
    this.writeRegistry(registry);
  }

  removeCompanion(skill: string, projectPath: string, absPath: string): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const previous = registry.deployments[key];
    const prevList = previous?.skillCompanions?.[skill]?.deployedCompanions;
    if (!previous || !prevList) return;

    const nextList = prevList.filter((p) => p !== absPath);
    if (nextList.length === prevList.length) return;

    if (nextList.length > 0) {
      registry.deployments[key] = {
        ...previous,
        skillCompanions: {
          ...previous.skillCompanions,
          [skill]: { deployedCompanions: nextList },
        },
      };
      this.writeRegistry(registry);
      return;
    }

    this.writeRegistry(registry);
    this.clearCompanions(skill, projectPath);
  }

  clearCompanions(skill: string, projectPath: string): void {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const previous = registry.deployments[key];
    if (!previous?.skillCompanions || !(skill in previous.skillCompanions)) {
      return;
    }
    const nextSkills = { ...previous.skillCompanions };
    delete nextSkills[skill];
    const nextEntry: DeploymentEntry = {
      ...previous,
      ...(Object.keys(nextSkills).length > 0
        ? { skillCompanions: nextSkills }
        : { skillCompanions: undefined }),
    };
    if (nextEntry.skillCompanions === undefined) {
      delete (nextEntry as { skillCompanions?: unknown }).skillCompanions;
    }
    registry.deployments[key] = nextEntry;
    this.writeRegistry(registry);
  }

  listAllCompanionPaths(projectPath: string): Array<{ skill: string; path: string }> {
    const key = normalizePath(projectPath);
    const registry = this.readRegistry();
    const entry = registry.deployments[key];
    if (!entry?.skillCompanions) return [];
    const out: Array<{ skill: string; path: string }> = [];
    for (const [skill, rec] of Object.entries(entry.skillCompanions)) {
      for (const p of rec.deployedCompanions) {
        out.push({ skill, path: p });
      }
    }
    return out;
  }
}

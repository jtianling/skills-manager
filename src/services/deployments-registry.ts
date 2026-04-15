import { dirname, join } from 'path';
import { existsSync, mkdirSync, realpathSync, renameSync, writeFileSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { fileExists, readFileContent } from '../utils/fs.js';

export interface DeploymentEntry {
  mode: 'link' | 'copy';
  followGroups: string[];
  pinnedSkills: string[];
  lastDeployedAt: string;
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

function normalizeEntry(raw: unknown): DeploymentEntry {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    mode: obj.mode === 'copy' ? 'copy' : 'link',
    followGroups: Array.isArray(obj.followGroups)
      ? (obj.followGroups as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    pinnedSkills: Array.isArray(obj.pinnedSkills)
      ? (obj.pinnedSkills as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    lastDeployedAt: typeof obj.lastDeployedAt === 'string' ? obj.lastDeployedAt : '',
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
    registry.deployments[key] = entry;
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
}

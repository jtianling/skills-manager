import { join } from 'path';
import { renameSync, writeFileSync } from 'fs';
import { fileExists, readFileContent } from '../utils/fs.js';
import { SkillInfo } from '../types.js';
import { GroupsService } from './groups.js';
import { SkillsService } from './skills.js';

export interface DeploymentManifest {
  mode: 'link' | 'copy';
  followGroups: string[];
  pinnedSkills: string[];
  deployedAt: string;
}

export interface ResolvedExpectedSkills {
  skills: SkillInfo[];
  skillKeys: Set<string>;
  warnings: string[];
}

export const MANIFEST_FILE = 'skillsmgr-deploy.json';

export function skillToKey(skill: SkillInfo): string {
  return `${skill.source}/${skill.name}`;
}

export function getManifestPath(projectRoot: string): string {
  return join(projectRoot, MANIFEST_FILE);
}

function normalizeManifest(parsed: unknown): DeploymentManifest {
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('manifest must be a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  const mode = obj.mode === 'copy' ? 'copy' : 'link';
  const followGroups = Array.isArray(obj.followGroups)
    ? (obj.followGroups as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const pinnedSkills = Array.isArray(obj.pinnedSkills)
    ? (obj.pinnedSkills as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const deployedAt = typeof obj.deployedAt === 'string' ? obj.deployedAt : '';
  return { mode, followGroups, pinnedSkills, deployedAt };
}

export class DeploymentManifestService {
  readManifest(projectRoot: string): DeploymentManifest | null {
    const path = getManifestPath(projectRoot);
    if (!fileExists(path)) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileContent(path));
    } catch (e) {
      throw new Error(
        `Invalid deployment manifest: ${path}.  Re-run \`skillsmgr deploy\` to regenerate. (${(e as Error).message})`,
      );
    }
    return normalizeManifest(parsed);
  }

  writeManifest(projectRoot: string, manifest: DeploymentManifest): void {
    const path = getManifestPath(projectRoot);
    const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
    renameSync(tmp, path);
  }

  resolveExpectedSkills(
    manifest: DeploymentManifest,
    groupsService: GroupsService,
    skillsService: SkillsService,
  ): ResolvedExpectedSkills {
    const allSkills = skillsService.getAllSkills();
    const byKey = new Map<string, SkillInfo>();
    for (const skill of allSkills) {
      byKey.set(skillToKey(skill), skill);
    }

    const expectedKeys = new Set<string>();
    const warnings: string[] = [];

    for (const groupName of manifest.followGroups) {
      const group = groupsService.getGroup(groupName);
      if (group === null) {
        warnings.push(`follow group '${groupName}' does not exist, skipping`);
        continue;
      }
      const members = groupsService.getGroupMembers(groupName);
      for (const key of members) {
        if (!byKey.has(key)) {
          warnings.push(`follow group '${groupName}' references missing skill '${key}', skipping`);
          continue;
        }
        expectedKeys.add(key);
      }
    }

    for (const key of manifest.pinnedSkills) {
      if (!byKey.has(key)) {
        warnings.push(`pinned skill '${key}' no longer exists, skipping`);
        continue;
      }
      expectedKeys.add(key);
    }

    const skills: SkillInfo[] = [];
    for (const key of expectedKeys) {
      const skill = byKey.get(key);
      if (skill) {
        skills.push(skill);
      }
    }

    return { skills, skillKeys: expectedKeys, warnings };
  }

  mergeForDeploy(
    prev: DeploymentManifest | null,
    incoming: { mode: 'link' | 'copy'; followGroups: string[]; pinnedSkills: string[] },
  ): DeploymentManifest {
    const followUnion = new Set<string>([
      ...(prev?.followGroups ?? []),
      ...incoming.followGroups,
    ]);

    return {
      mode: incoming.mode,
      followGroups: [...followUnion].sort(),
      pinnedSkills: [...new Set(incoming.pinnedSkills)].sort(),
      deployedAt: new Date().toISOString(),
    };
  }
}

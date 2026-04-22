import { GroupsService, validateGroupName } from '../services/groups.js';
import { RegistryService } from '../services/registry.js';
import { getToken } from '../services/auth.js';
import type { InstallOptions, CollectionMember, CollectionWarning } from '../types.js';
import { normalizeCollectionRef } from '../utils/source-detection.js';
import { promptConfirm } from '../utils/prompts.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';
import { ensureSetup } from './setup.js';
import { installFromRegistry } from './install-registry.js';

const registryService = new RegistryService();

export async function resolveCollectionMembers(ref: string): Promise<{
  normalizedRef: string;
  members: Array<{ packageName: string; pinnedVersion: string | null; source: string }>;
  warnings: CollectionWarning[];
}> {
  const normalizedRef = normalizeCollectionRef(ref);
  const token = getToken();
  const resolved = await registryService.resolveCollection(
    { extends: [normalizedRef] },
    token,
  );
  return { normalizedRef, members: resolved.members, warnings: resolved.warnings };
}

export function memberToSkillName(packageName: string): string {
  // @scope/name → name; otherwise use as-is
  const slashIdx = packageName.indexOf('/');
  return slashIdx >= 0 ? packageName.slice(slashIdx + 1) : packageName;
}

/**
 * Resolve a collection ref and convert members to skill names.
 * Prints warnings. Returns null when collection is empty (caller should return early).
 */
export async function expandCollectionRefToSkillNames(
  ref: string,
): Promise<{ normalizedRef: string; skillNames: string[] } | null> {
  const { normalizedRef, members, warnings } = await resolveCollectionMembers(ref);
  for (const w of warnings) {
    console.log(`⚠ [${w.kind}] ${w.detail}`);
  }
  if (members.length === 0) {
    console.log(`Collection '${normalizedRef}' is empty.`);
    return null;
  }
  return {
    normalizedRef,
    skillNames: members.map((m) => memberToSkillName(m.packageName)),
  };
}

interface CollectionInstallResult {
  packageName: string;
  version: string | null;
  status: 'installed' | 'failed';
  error?: string;
}

function printWarnings(warnings: CollectionWarning[]): void {
  if (warnings.length === 0) return;
  console.log('');
  for (const w of warnings) {
    const prefix = w.kind === 'private-skipped' ? 'Private' : w.kind;
    console.log(`⚠ [${prefix}] ${w.detail}`);
  }
}

export async function executeInstallFromCollection(
  ref: string,
  options: InstallOptions,
): Promise<void> {
  if (options.y) {
    if (!options.all) options.all = true;
  }

  const origLog = console.log;
  if (options.json) {
    console.log = (...args: unknown[]) => console.error(...args);
  }

  await ensureSetup();

  // Validate group early
  if (options.group) {
    try {
      validateGroupName(options.group);
    } catch (e) {
      if (options.json) {
        console.log = origLog;
        jsonError((e as Error).message, 'INVALID_GROUP');
      } else {
        console.error(`Error: ${(e as Error).message}`);
      }
      process.exit(1);
    }

    const groupsService = new GroupsService();
    if (groupsService.getGroupKind(options.group) === 'local-batch') {
      const message = `Cannot add to physical group '${options.group}'. Use a virtual group name instead.`;
      if (options.json) {
        console.log = origLog;
        jsonError(message, 'INVALID_GROUP');
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }
  }

  // Normalize ref
  let normalizedRef: string;
  try {
    normalizedRef = normalizeCollectionRef(ref);
  } catch (e) {
    if (options.json) {
      console.log = origLog;
      jsonError((e as Error).message, 'INVALID_COLLECTION_REF');
    } else {
      console.error(`Error: ${(e as Error).message}`);
    }
    process.exit(1);
  }

  // Resolve
  console.log(`Resolving collection "${normalizedRef}"...`);
  const token = getToken();

  let resolved;
  try {
    resolved = await registryService.resolveCollection(
      { extends: [normalizedRef] },
      token,
    );
  } catch (e) {
    if (options.json) {
      console.log = origLog;
      jsonError((e as Error).message, 'COLLECTION_RESOLVE_FAILED');
    } else {
      console.error(`Error: ${(e as Error).message}`);
    }
    process.exit(1);
  }

  printWarnings(resolved.warnings);

  if (resolved.members.length === 0) {
    console.log(`Collection '${normalizedRef}' is empty.`);
    if (options.json) {
      console.log = origLog;
      jsonOutput({
        collection: normalizedRef,
        members: [],
        installed: [],
        failed: [],
        warnings: resolved.warnings,
      });
    }
    return;
  }

  // Show list + confirm
  console.log(`\nSkills from '${normalizedRef}' (${resolved.members.length}):`);
  for (const m of resolved.members) {
    const v = m.pinnedVersion ? `@${m.pinnedVersion}` : '';
    console.log(`  ${m.packageName}${v}`);
  }

  if (!options.all) {
    const ok = await promptConfirm(`Install ${resolved.members.length} skills?`);
    if (!ok) {
      console.log('Cancelled.');
      if (options.json) {
        console.log = origLog;
        jsonOutput({
          collection: normalizedRef,
          members: resolved.members,
          installed: [],
          failed: [],
          warnings: resolved.warnings,
          cancelled: true,
        });
      }
      return;
    }
  }

  // Install each member serially
  const results: CollectionInstallResult[] = [];
  const groupsService = new GroupsService();
  const installedSourceKeys: string[] = [];

  for (const member of resolved.members) {
    console.log(`\n=== Installing ${member.packageName}${member.pinnedVersion ? `@${member.pinnedVersion}` : ''} ===`);
    try {
      const result = await installFromRegistry(
        {
          type: 'registry',
          packageName: member.packageName,
          requestedVersion: member.pinnedVersion ?? undefined,
        },
        { ...options, all: true },
      );
      if (result.sourceKeys) {
        installedSourceKeys.push(...result.sourceKeys);
      }
      results.push({
        packageName: member.packageName,
        version: member.pinnedVersion,
        status: 'installed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      results.push({
        packageName: member.packageName,
        version: member.pinnedVersion,
        status: 'failed',
        error: message,
      });
    }
  }

  // Group assignment
  if (options.group && installedSourceKeys.length > 0) {
    for (const key of installedSourceKeys) {
      groupsService.addSkill(options.group, key);
    }
  }

  const installedList = results.filter((r) => r.status === 'installed');
  const failedList = results.filter((r) => r.status === 'failed');

  console.log(`\nInstalled: ${installedList.length}, Failed: ${failedList.length}`);

  if (options.json) {
    console.log = origLog;
    jsonOutput({
      collection: normalizedRef,
      members: resolved.members,
      installed: installedList,
      failed: failedList,
      warnings: resolved.warnings,
    });
  }

  if (installedList.length === 0 && failedList.length > 0) {
    process.exit(1);
  }
}

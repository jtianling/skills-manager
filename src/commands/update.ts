import { Command } from 'commander';
import { basename } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { BundleManager, BundleSyncResult } from '../services/bundle-manager.js';
import {
  AffectedProjects,
  DeploymentsRegistryService,
} from '../services/deployments-registry.js';
import { GitHubService } from '../services/github.js';
import { GroupManager } from '../services/group-manager.js';
import { GroupsService } from '../services/groups.js';
import { RegistryService } from '../services/registry.js';
import { SourcesService } from '../services/sources.js';
import { SourceUpdater, UpdateResult } from '../services/source-updater.js';
import { SkillsService } from '../services/skills.js';
import { ResolvedTarget, SourceResolver } from '../services/source-resolver.js';
import { fileExists, getDirectoriesInDir } from '../utils/fs.js';
import { promptConfirm } from '../utils/prompts.js';
import { detectSourceType, normalizeCollectionRef } from '../utils/source-detection.js';
import { getToken } from '../services/auth.js';
import { installFromRegistry } from './install-registry.js';
import { memberToSkillName } from './install-collection.js';
import { normalizeLocalPath } from '../utils/url-normalize.js';
import { ensureSetup } from './setup.js';

const groupsService = new GroupsService();
const sourcesService = new SourcesService();
const githubService = new GitHubService();
const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
const sourceResolver = new SourceResolver(
  sourcesService,
  skillsService,
  githubService
);
const bundleManager = new BundleManager(sourcesService, githubService);
const sourceUpdater = new SourceUpdater(
  sourcesService,
  githubService,
  new RegistryService(),
  groupsService,
);
const groupManager = new GroupManager(
  sourcesService,
  groupsService,
  githubService,
  new RegistryService(),
);

interface UpdateOptions {
  sync?: boolean;
  keepLocal?: boolean;
  verbose?: boolean;
  force?: boolean;
}

function isTopLevelCustomSourceKey(key: string): boolean {
  return key.startsWith('custom/') && key.split('/').length === 2;
}

function getResolvedSkillSourceKeys(target: ResolvedTarget): string[] {
  const skills = target.skills ?? [];
  const keys = skills.map((skill) =>
    skill.source.startsWith('custom')
      ? `${skill.source}/${skill.name}`
      : skill.source,
  );

  return [...new Set(keys)];
}

function countStandaloneLocalSkills(): number {
  const customDir = `${SKILLS_MANAGER_DIR}/custom`;
  if (!fileExists(customDir)) {
    return 0;
  }

  return getDirectoriesInDir(customDir)
    .filter((entry) => fileExists(`${entry.path}/SKILL.md`))
    .length;
}

function isRebindCandidate(
  target: ResolvedTarget,
): target is ResolvedTarget & {
  kind: 'rebind-candidate';
  candidateType: 'source' | 'group';
  candidateKey: string;
  candidateUrl: string;
  newAbsolutePath: string;
  candidateStructureType: 'single' | 'batch';
} {
  return (
    target.kind === 'rebind-candidate' &&
    target.candidateType !== undefined &&
    target.candidateKey !== undefined &&
    target.candidateUrl !== undefined &&
    target.newAbsolutePath !== undefined &&
    target.candidateStructureType !== undefined
  );
}

function getRebindPromptMessage(target: ResolvedTarget & {
  candidateType: 'source' | 'group';
  candidateUrl: string;
  newAbsolutePath: string;
}): string {
  const name = basename(target.newAbsolutePath);
  const noun = target.candidateType === 'group' ? 'group' : 'skill';
  return (
    `Rebind local ${noun} '${name}'?\n` +
    `Old path: ${target.candidateUrl}\n` +
    `New path: ${target.newAbsolutePath}`
  );
}

async function maybeRebindTarget(
  source: string,
  target: ResolvedTarget,
  options: UpdateOptions,
): Promise<ResolvedTarget | null> {
  if (!isRebindCandidate(target)) {
    return target;
  }

  if (!options.force) {
    const confirmed = await promptConfirm(getRebindPromptMessage(target), false);
    if (!confirmed) {
      console.log('Cancelled.');
      return null;
    }
  }

  if (target.candidateType === 'group') {
    groupManager.rebindPhysicalGroup(target.candidateKey, target.newAbsolutePath);
  } else {
    sourcesService.rebindLocalSource(target.candidateKey, target.newAbsolutePath);
  }

  const reboundTarget = await sourceResolver.resolve(source);
  if (reboundTarget.kind === 'rebind-candidate' || reboundTarget.kind === 'not-found') {
    throw new Error(`Failed to resolve ${source} after rebinding`);
  }

  return reboundTarget;
}

function printUpdateNotFound(source: string, target: ResolvedTarget): void {
  if (
    detectSourceType(source) === 'local-path' &&
    target.reason?.includes('(still exists)')
  ) {
    console.log(
      'Hint: The old path still exists. Remove or rename the old directory before running update again.',
    );
    console.log(target.reason);
    return;
  }

  if (detectSourceType(source) === 'local-path' && target.reason) {
    console.log(target.reason);
    return;
  }

  console.log(`Source '${source}' not found.`);
  if (target.reason) {
    console.log(target.reason);
  }

  const allSources = sourcesService.getAllSources();
  console.log('\nInstalled sources:');
  for (const key of Object.keys(allSources)) {
    console.log(`  ${key}`);
  }
}

export async function executeUpdate(source?: string): Promise<void> {
  return executeUpdateWithOptions(source);
}

const GENERIC_REFRESH_REMINDER =
  'Note: projects following this physical group may need `skillsmgr deploy --refresh` to pick up changes.';

function computeAffectedProjects(
  groupName: string | undefined,
  members: string[] | undefined,
): AffectedProjects | null {
  if (!groupName || !members) {
    return null;
  }
  try {
    return new DeploymentsRegistryService().findAffectedByGroup(groupName, members);
  } catch (e) {
    console.warn(`⚠ ${(e as Error).message}`);
    return null;
  }
}

function printAffectedProjects(affected: AffectedProjects): void {
  console.log("Projects using this bundle's group:");
  if (affected.follow.length > 0) {
    console.log('  follow (will auto-add on next refresh):');
    for (const entry of affected.follow) {
      console.log(`    - ${entry.path}`);
    }
  }
  if (affected.pinned.length > 0) {
    console.log('  pinned (re-deploy to include):');
    for (const entry of affected.pinned) {
      console.log(`    - ${entry.path}`);
    }
  }
  if (affected.missing.length > 0) {
    console.log('  (path missing, run `skillsmgr deployments prune`):');
    for (const entry of affected.missing) {
      console.log(`    - ${entry.path}`);
    }
  }
}

function printBundleUpdateSummary(result: BundleSyncResult): void {
  console.log(
    `\nDone! ${result.updated} updated, ${result.added} added, ` +
      `${result.removedKept} removed (kept), ${result.removedHard} removed, ` +
      `${result.upToDate} up to date, ${result.failed} failed`
  );
}

function looksLikeCollectionRef(input: string): boolean {
  // Only treat refs that explicitly start with @ as collection refs to avoid
  // colliding with GitHub-style "owner/repo" sources update already handles.
  // URL forms (skillsmgr.dev/c/...) are also accepted.
  if (input.startsWith('@')) {
    try {
      normalizeCollectionRef(input);
      return true;
    } catch {
      return false;
    }
  }
  if (input.includes('/c/')) {
    try {
      normalizeCollectionRef(input);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function updateCollectionGroup(input: string): Promise<void> {
  const ref = normalizeCollectionRef(input);
  const existing = groupsService.getCollectionGroup(ref);
  if (!existing) {
    console.error(`Error: collection group '${ref}' not installed. Run: skillsmgr install --from ${ref}`);
    process.exit(1);
  }

  console.log(`Resolving collection "${ref}"...`);
  const token = getToken();
  const registry = new RegistryService();
  let resolved;
  try {
    resolved = await registry.resolveCollection({ extends: [ref] }, token);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  for (const w of resolved.warnings) {
    console.log(`⚠ [${w.kind}] ${w.detail}`);
  }

  if (resolved.members.length === 0) {
    console.log(`Collection '${ref}' is empty on the server.`);
    return;
  }

  // Existing members are stored as source keys (registry/<pkg>)
  const existingKeys = new Set(existing.members);
  const desiredKeys: string[] = [];
  const newMembers: typeof resolved.members = [];

  for (const m of resolved.members) {
    const key = `registry/${m.packageName}`;
    desiredKeys.push(key);
    if (!existingKeys.has(key)) {
      newMembers.push(m);
    }
  }

  // Install new members
  const newlyInstalled: string[] = [];
  for (const member of newMembers) {
    console.log(`\n=== Installing ${member.packageName}${member.pinnedVersion ? `@${member.pinnedVersion}` : ''} ===`);
    try {
      const result = await installFromRegistry(
        {
          type: 'registry',
          packageName: member.packageName,
          requestedVersion: member.pinnedVersion ?? undefined,
        },
        { all: true },
      );
      if (result.sourceKeys && result.sourceKeys.length > 0) {
        newlyInstalled.push(...result.sourceKeys);
      } else {
        newlyInstalled.push(`registry/${member.packageName}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to install ${member.packageName}: ${msg}`);
    }
  }

  // Members removed by the server: prune from group snapshot but don't uninstall
  const removed = existing.members.filter((k) => !desiredKeys.includes(k));

  // Persist updated snapshot
  groupsService.setCollectionGroupMembers(ref, desiredKeys);

  console.log(
    `\nAdded: ${newlyInstalled.length}, Removed from snapshot: ${removed.length}, Unchanged: ${desiredKeys.length - newlyInstalled.length}`,
  );
  if (removed.length > 0) {
    console.log(
      `Note: ${removed.length} skill(s) no longer in collection — local copies kept. Run \`skillsmgr uninstall <name>\` to remove them.`,
    );
  }
  // Use memberToSkillName to silence "unused import" until needed elsewhere
  void memberToSkillName;
}

export async function executeUpdateWithOptions(
  source?: string,
  options: UpdateOptions = {},
): Promise<void> {
  await ensureSetup();

  // Route collection refs (e.g. "@alice/kit") to collection sync
  if (source && looksLikeCollectionRef(source)) {
    await updateCollectionGroup(source);
    return;
  }

  let allSources = sourcesService.getAllSources();
  const skippedLocalCount = source ? 0 : countStandaloneLocalSkills();

  if (!source && Object.keys(allSources).length === 0 && skippedLocalCount === 0) {
    console.log('No installed sources found.');
    console.log('\nRun: skillsmgr install anthropics/skills');
    return;
  }

  // If specific source provided, only update that one
  if (source) {
    let target = await sourceResolver.resolve(source);

    if (target.kind === 'rebind-candidate') {
      const reboundTarget = await maybeRebindTarget(source, target, options);
      if (!reboundTarget) {
        return;
      }
      target = reboundTarget;
      allSources = sourcesService.getAllSources();
    }

    if (target.kind === 'not-found') {
      printUpdateNotFound(source, target);
      return;
    }

    if (target.kind === 'bundle') {
      const bundleId = target.bundleId;
      if (!bundleId) {
        throw new Error(`Missing bundle id for ${source}`);
      }

      console.log(`Updating ${bundleId}...\n`);
      const result = await bundleManager.sync(bundleId, {
        sync: options.sync,
        verbose: options.verbose,
      });
      if (result.failed > 0) {
        process.exitCode = 1;
      }
      printBundleUpdateSummary(result);
      return;
    }

    if (target.kind === 'group') {
      if (!target.groupName || !target.groupKind) {
        throw new Error(`Missing group metadata for ${source}`);
      }

      console.log(`Updating ${target.groupName}...\n`);
      if (target.groupKind === 'local-batch') {
        const result = await groupManager.updatePhysicalGroup(target.groupName, {
          keepLocal: options.keepLocal,
          verbose: options.verbose,
        });
        if (result.failed > 0) {
          process.exitCode = 1;
        }
        console.log(
          `\nDone! ${result.updated} updated, ${result.added} added, ` +
          `${result.kept} removed (kept), ${result.removed} removed, ` +
          `${result.upToDate} up to date, ${result.failed} failed`,
        );

        const hasChanges = result.added + result.removed + result.kept > 0;
        if (hasChanges) {
          const affected = computeAffectedProjects(result.groupName, result.members);
          if (affected && affected.follow.length + affected.pinned.length + affected.missing.length > 0) {
            printAffectedProjects(affected);
          } else {
            console.log(GENERIC_REFRESH_REMINDER);
          }
        }
      } else {
        const result = await groupManager.updateVirtualGroup(target.groupName);
        if (result.failed > 0) {
          process.exitCode = 1;
        }
        console.log(
          `\nDone! ${result.updated} updated, ${result.upToDate} up to date, ` +
          `${result.failed} failed, ${result.skipped} skipped`,
        );
      }
      return;
    }

    const sourceKeys = target.kind === 'skill'
      ? getResolvedSkillSourceKeys(target)
      : target.sourceKeys;
    const totals: UpdateResult = { updated: 0, upToDate: 0, failed: 0, skipped: 0 };
    const sourceType = detectSourceType(source);

    for (const key of sourceKeys) {
      const info = allSources[key];
      if (!info) {
        if (sourceType === 'local-path' && isTopLevelCustomSourceKey(key)) {
          console.log(`Updating ${key}...\n`);
          const result = sourceUpdater.updateLocalPath(key, normalizeLocalPath(source));
          totals.updated += result.updated;
          totals.upToDate += result.upToDate;
          totals.failed += result.failed;
          totals.skipped += result.skipped;
          continue;
        }

        totals.failed++;
        continue;
      }

      console.log(`Updating ${key}...\n`);
      const result = target.kind === 'skill'
        ? await sourceUpdater.updateSource(key, info, {
          selectedSkillNames: new Set((target.skills ?? []).map((skill) => skill.name)),
          targetVersion: target.requestedVersion,
        })
        : await sourceUpdater.updateSource(key, info, {
          targetVersion: target.requestedVersion,
        });
      totals.updated += result.updated;
      totals.upToDate += result.upToDate;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    console.log(
      `\nDone! ${totals.updated} updated, ${totals.upToDate} up to date, ` +
        `${totals.failed} failed, ${totals.skipped} skipped`
    );
    if (totals.failed > 0) {
      process.exitCode = 1;
    }
    return;
  }

  // Update all sources
  console.log('Updating all installed sources...\n');

  let totalUpdated = 0;
  let totalUpToDate = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [key, info] of Object.entries(allSources)) {
    if (info.installMethod === 'local-copy') {
      continue;
    }

    console.log(`${key}:`);
    const result = await sourceUpdater.updateSource(key, info);
    totalUpdated += result.updated;
    totalUpToDate += result.upToDate;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
    console.log();
  }

  console.log(`Done! ${totalUpdated} updated, ${totalUpToDate} up to date, ${totalFailed} failed, ${totalSkipped} skipped`);
  if (skippedLocalCount > 0) {
    console.log(
      `${skippedLocalCount} local skill(s) skipped. Use \`skillsmgr update ./path\` to update a local skill.`,
    );
  }
  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

export const updateCommand = new Command('update')
  .description('Update installed skills to latest version')
  .argument('[source]', 'Specific source to update (e.g., "anthropic")')
  .option('-y, --force', 'Skip rebind confirmation when a moved local path is detected')
  .option('--sync', 'Compatibility flag, physical groups sync by default')
  .option('--keep-local', 'Keep orphaned skills when updating a physical group')
  .option('-v, --verbose', 'Show every physical group member status during sync')
  .action(async (source: string | undefined, options: UpdateOptions) => {
    await executeUpdateWithOptions(source, options);
  });

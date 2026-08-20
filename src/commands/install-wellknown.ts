import { join } from 'path';
import { SourcesService } from '../services/sources.js';
import {
  discoverIndex,
  type DiscoveryFailure,
  type DiscoveryHit,
} from '../services/wellknown/discovery.js';
import { fetchSkill } from '../services/wellknown/fetch-skill.js';
import {
  getWellKnownInstallDir,
  normalizeWellKnownHost,
  wellKnownSourceKey,
} from '../services/wellknown/hostname.js';
import type { WellKnownEntry } from '../services/wellknown/index-schema.js';
import type { InstallOptions } from '../types.js';
import { findScriptFiles, warnScriptFiles } from '../utils/fs.js';
import {
  createInstallResult,
  getLocalOverwriteMessage,
  prepareTargetDir,
  selectSkills,
  type InstallableSkill,
  type InstallResult,
} from './install-utils.js';

const sourcesService = new SourcesService();

function buildDiscoveryError(source: string, failure: DiscoveryFailure): string {
  const probed = failure.probedUrls.map((url) => `  - ${url}`).join('\n');
  const discarded = failure.discarded
    .map((entry) => `  - ${entry.name}: ${entry.reason}`)
    .join('\n');

  const reason = failure.discarded.length > 0
    ? `Every skill entry was rejected:\n${discarded}`
    : 'No well-known skills index was served.';

  return (
    `Cannot install from ${source}. ${reason}\n` +
    `Probed:\n${probed}\n` +
    'If this address is a git repository, declare it explicitly with a ' +
    `".git" suffix: skillsmgr install ${source.replace(/\/+$/, '')}.git`
  );
}

interface FetchOutcome {
  installedPaths: string[];
  installedNames: string[];
  digests: Record<string, string>;
  failures: string[];
}

async function fetchSelectedSkills(
  hit: DiscoveryHit,
  selected: InstallableSkill[],
  entriesByName: Map<string, WellKnownEntry>,
  force?: boolean,
): Promise<FetchOutcome> {
  const installedPaths: string[] = [];
  const installedNames: string[] = [];
  const failures: string[] = [];
  const digests: Record<string, string> = {};

  for (const skill of selected) {
    const entry = entriesByName.get(skill.name);
    if (!entry) {
      continue;
    }

    const ready = await prepareTargetDir(
      skill.path,
      getLocalOverwriteMessage(skill.name),
      force,
    );
    if (!ready) {
      continue;
    }

    try {
      const { digest } = await fetchSkill(entry, {
        origin: hit.origin,
        wellKnownPath: hit.wellKnownPath,
        destDir: skill.path,
      });
      digests[skill.name] = digest;
      installedPaths.push(skill.path);
      installedNames.push(skill.name);
    } catch (error) {
      failures.push(`${skill.name}: ${(error as Error).message}`);
      console.error(`  ✗ ${skill.name}: ${(error as Error).message}`);
    }
  }

  return { installedPaths, installedNames, digests, failures };
}

function reportInstalled(
  origin: string,
  selected: InstallableSkill[],
  outcome: FetchOutcome,
): void {
  console.log(
    `✓ Installed ${outcome.installedPaths.length} skill(s) from ${origin}`,
  );
  for (const skill of selected) {
    if (outcome.digests[skill.name]) {
      console.log(`  - ${skill.name}: ${skill.description || '(no description)'}`);
    }
  }
}

async function installSelected(
  hit: DiscoveryHit,
  selected: InstallableSkill[],
  entriesByName: Map<string, WellKnownEntry>,
  host: string,
  options: InstallOptions,
): Promise<InstallResult> {
  const sourceKey = wellKnownSourceKey(host);
  const outcome = await fetchSelectedSkills(
    hit,
    selected,
    entriesByName,
    options.force,
  );

  if (outcome.installedPaths.length === 0) {
    if (outcome.failures.length === 0) {
      return createInstallResult([], []);
    }
    throw new Error(
      `Failed to install any skill from ${hit.origin}:\n  ` +
      outcome.failures.join('\n  '),
    );
  }

  warnScriptFiles(outcome.installedPaths.flatMap((path) => findScriptFiles(path)));

  sourcesService.addSource(sourceKey, {
    url: hit.origin,
    type: 'well-known',
    repoName: host,
    installMethod: 'well-known',
    skillDigests: {
      ...sourcesService.getSource(sourceKey)?.skillDigests,
      ...outcome.digests,
    },
  });

  reportInstalled(hit.origin, selected, outcome);

  return createInstallResult(
    outcome.installedPaths,
    outcome.installedPaths.map(() => sourceKey),
    { skillKeys: outcome.installedNames.map((name) => `${sourceKey}/${name}`) },
  );
}

export async function installFromWellKnown(
  source: string,
  options: InstallOptions,
): Promise<InstallResult> {
  const discovery = await discoverIndex(source);
  if (!discovery.ok) {
    throw new Error(buildDiscoveryError(source, discovery.failure));
  }

  const { hit } = discovery;
  const host = normalizeWellKnownHost(hit.origin);
  const baseDir = getWellKnownInstallDir(host);

  console.log(`Found ${hit.entries.length} skill(s) at ${hit.indexUrl}`);

  const entriesByName = new Map<string, WellKnownEntry>(
    hit.entries.map((entry) => [entry.name, entry]),
  );
  const candidates = hit.entries.map((entry) => ({
    name: entry.name,
    description: entry.description,
    path: join(baseDir, entry.name),
  }));

  const { skills: selected } = await selectSkills(candidates, options);
  if (selected.length === 0) {
    return createInstallResult([], []);
  }

  return installSelected(hit, selected, entriesByName, host, options);
}

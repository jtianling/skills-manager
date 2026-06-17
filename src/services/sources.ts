import { renameSync, rmSync } from 'fs';
import { basename as pathBasename, dirname, join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import type {
  Bundle,
  BundleInfo,
  BundleType,
  GroupEntry,
} from '../types.js';
import { ensureDir, fileExists, readFileContent, writeFile } from '../utils/fs.js';
import {
  makeBundleId,
  normalizeGitUrl,
  normalizeLocalPath,
} from '../utils/url-normalize.js';
import { GroupsService } from './groups.js';
import { logMigrationLines } from './migration-logger.js';

function getSourcesFile(): string {
  return join(SKILLS_MANAGER_DIR, 'sources.json');
}

function atomicWrite(path: string, content: string): void {
  const tempFile = `${path}.tmp`;
  ensureDir(dirname(path));

  try {
    writeFile(tempFile, content);
    renameSync(tempFile, path);
  } catch (error) {
    if (fileExists(tempFile)) {
      rmSync(tempFile, { force: true });
    }
    throw error;
  }
}

export interface SourceInfo {
  url: string;
  type: 'official' | 'community' | 'custom' | 'registry';
  repoName: string;
  installMethod?: 'git' | 'zip' | 'local-copy' | 'registry';
  version?: string;
  registryUrl?: string;
  installedAt: string;
  updatedAt: string;
}

interface SourcesDataV1 {
  version?: '1.0';
  sources: Record<string, SourceInfo>;
  bundles?: Record<string, Bundle>;
}

interface StoredSourcesData {
  version: '2.0' | '3.0';
  sources: Record<string, SourceInfo>;
  bundles: Record<string, Bundle>;
}

function isTopLevelLocalCopySource(
  key: string,
  info: Pick<SourceInfo, 'installMethod'>,
): boolean {
  return info.installMethod === 'local-copy' && key.split('/').length === 2;
}

function isStoredSourcesData(data: unknown): data is StoredSourcesData {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<StoredSourcesData>;
  return (
    (candidate.version === '2.0' || candidate.version === '3.0') &&
    candidate.sources !== undefined &&
    candidate.bundles !== undefined
  );
}

export class SourcesService {
  constructor(
    private readonly groupsService: GroupsService = new GroupsService(),
  ) {}

  private load(): StoredSourcesData {
    const sourcesFile = getSourcesFile();

    if (!fileExists(sourcesFile)) {
      return { version: '3.0', sources: {}, bundles: {} };
    }

    const raw = readFileContent(sourcesFile);
    const parsed = JSON.parse(raw) as Partial<StoredSourcesData> | SourcesDataV1;

    if (parsed.version === '3.0' && isStoredSourcesData(parsed)) {
      return this.normalizeLoadedData(parsed, '3.0');
    }

    const v2Data = parsed.version === '2.0' && isStoredSourcesData(parsed)
      ? this.normalizeLoadedData(parsed, '2.0')
      : this.migrateV1ToV2(parsed as SourcesDataV1);
    const migrated = this.migrateV2ToV3(v2Data);

    try {
      this.writeBackup(raw, 'v2.backup');
      this.save(migrated);
    } catch {
      return migrated;
    }

    if (v2Data.version !== '3.0') {
      const migratedCount = Object.values(v2Data.bundles)
        .filter((bundle) => bundle.type === 'local-batch')
        .length;
      logMigrationLines([
        `  ✓ sources.json V2 → V3: ${migratedCount} local-batch bundles → physical groups`,
      ]);
    }

    return migrated;
  }

  private save(data: StoredSourcesData): void {
    atomicWrite(getSourcesFile(), JSON.stringify(data, null, 2));
  }

  private writeBackup(content: string, suffix: string): void {
    atomicWrite(`${getSourcesFile()}.${suffix}`, content);
  }

  private normalizeLoadedData(
    data: Partial<StoredSourcesData> | SourcesDataV1,
    version: '2.0' | '3.0',
  ): StoredSourcesData {
    const bundles = data.bundles ?? {};
    if (version === '3.0') {
      for (const [id, bundle] of Object.entries(bundles)) {
        if (bundle.type === 'local-batch') {
          throw new Error(
            `Invalid V3 sources.json: local-batch bundle '${id}' must be stored as a physical group.`,
          );
        }
      }
    }

    return {
      version,
      sources: Object.entries(data.sources ?? {}).reduce<Record<string, SourceInfo>>(
        (acc, [key, info]) => {
          if (isTopLevelLocalCopySource(key, info)) {
            return acc;
          }

          return {
            ...acc,
            [key]: info,
          };
        },
        {},
      ),
      bundles,
    };
  }

  private migrateV1ToV2(data: SourcesDataV1): StoredSourcesData {
    const sources = data.sources ?? {};
    const grouped = new Map<string, { type: BundleType; url: string; members: string[] }>();

    for (const [key, info] of Object.entries(sources)) {
      const bundle = this.getMigrationBundleCandidate(info);
      if (!bundle) {
        continue;
      }

      const groupKey = makeBundleId(bundle.type, bundle.url);
      const existing = grouped.get(groupKey);

      if (existing) {
        grouped.set(groupKey, {
          ...existing,
          members: [...existing.members, key],
        });
        continue;
      }

      grouped.set(groupKey, {
        ...bundle,
        members: [key],
      });
    }

    const bundles = Array.from(grouped.entries()).reduce<Record<string, Bundle>>(
      (acc, [id, bundle]) => {
        if (bundle.members.length <= 1) {
          return acc;
        }

        const timestamps = bundle.members
          .map((member) => sources[member])
          .filter((info): info is SourceInfo => info !== undefined);
        const installedAt = timestamps
          .map((info) => info.installedAt)
          .sort()[0] ?? new Date().toISOString();
        const updatedAt = timestamps
          .map((info) => info.updatedAt)
          .sort()
          .at(-1) ?? installedAt;

        return {
          ...acc,
          [id]: {
            type: bundle.type,
            url: bundle.url,
            selectionMode: 'all',
            members: bundle.members,
            installedAt,
            updatedAt,
          },
        };
      },
      {},
    );

    return {
      version: '2.0',
      sources,
      bundles,
    };
  }

  private migrateV2ToV3(data: StoredSourcesData): StoredSourcesData {
    if (data.version === '3.0') {
      return data;
    }

    const bundles = Object.entries(data.bundles).reduce<Record<string, Bundle>>(
      (acc, [id, bundle]) => {
        if (bundle.type === 'local-batch') {
          const groupName = pathBasename(normalizeLocalPath(bundle.url));
          this.groupsService.migrateLocalBatchToPhysicalGroup(groupName, {
            ...bundle,
            url: normalizeLocalPath(bundle.url),
          });
          return acc;
        }

        return {
          ...acc,
          [id]: bundle,
        };
      },
      {},
    );

    return {
      version: '3.0',
      sources: data.sources,
      bundles,
    };
  }

  private getMigrationBundleCandidate(
    info: SourceInfo,
  ): { type: BundleType; url: string } | null {
    if (info.installMethod === 'git') {
      const normalized = normalizeGitUrl(info.url);
      return normalized ? { type: 'git', url: normalized } : null;
    }

    if (info.installMethod === 'local-copy') {
      return { type: 'local-batch', url: normalizeLocalPath(info.url) };
    }

    if (info.installMethod === 'zip') {
      const isRemote = info.url.startsWith('http://') || info.url.startsWith('https://');
      return {
        type: 'zip',
        url: isRemote ? info.url : normalizeLocalPath(info.url),
      };
    }

    return null;
  }

  private createLocalBatchBundleFromGroup(
    name: string,
    group: Extract<GroupEntry, { kind: 'local-batch' }>,
  ): Bundle {
    return {
      type: 'local-batch',
      url: normalizeLocalPath(group.url),
      selectionMode: 'all',
      members: this.groupsService.getGroupMembers(name),
      installedAt: group.installedAt,
      updatedAt: group.updatedAt,
    };
  }

  private findPhysicalGroupByUrl(
    normalizedUrl: string,
  ): { name: string; group: Extract<GroupEntry, { kind: 'local-batch' }> } | null {
    for (const name of this.groupsService.listGroups()) {
      const group = this.groupsService.getGroup(name);
      if (!group || group.kind !== 'local-batch') {
        continue;
      }

      if (normalizeLocalPath(group.url) === normalizedUrl) {
        return { name, group };
      }
    }

    return null;
  }

  addSource(key: string, info: Omit<SourceInfo, 'installedAt' | 'updatedAt'>): void {
    if (isTopLevelLocalCopySource(key, info)) {
      throw new Error(
        `Refusing to persist local-copy source: ${key}. ` +
        'Local skills are tracked by disk presence under custom/.',
      );
    }

    const data = this.load();
    const now = new Date().toISOString();

    data.sources[key] = {
      ...info,
      installedAt: data.sources[key]?.installedAt || now,
      updatedAt: now,
    };

    this.save(data);
  }

  getSource(key: string): SourceInfo | undefined {
    const data = this.load();
    return data.sources[key];
  }

  getAllSources(): Record<string, SourceInfo> {
    const data = this.load();
    return data.sources;
  }

  getAllBundles(): Record<string, Bundle> {
    const data = this.load();
    return data.bundles;
  }

  getBundle(id: string): Bundle | undefined {
    const data = this.load();
    return data.bundles[id];
  }

  removeSource(key: string): void {
    const data = this.load();
    delete data.sources[key];
    this.save(data);
  }

  updateTimestamp(key: string): void {
    const data = this.load();
    if (data.sources[key]) {
      data.sources[key].updatedAt = new Date().toISOString();
      this.save(data);
    }
  }

  updateVersion(key: string, version: string): void {
    const data = this.load();
    const existing = data.sources[key];
    if (!existing) {
      return;
    }

    data.sources[key] = {
      ...existing,
      version,
      updatedAt: new Date().toISOString(),
    };
    this.save(data);
  }

  addBundle(
    id: string,
    info: Omit<BundleInfo, 'installedAt' | 'updatedAt'>,
  ): void {
    if (info.type === 'local-batch') {
      throw new Error('local-batch bundles must be stored as physical groups in groups.json');
    }

    const data = this.load();
    const now = new Date().toISOString();

    data.bundles[id] = {
      ...info,
      installedAt: data.bundles[id]?.installedAt ?? now,
      updatedAt: now,
    };

    this.save(data);
  }

  updateBundleMembers(id: string, members: string[]): void {
    const data = this.load();
    const existing = data.bundles[id];
    if (!existing) {
      return;
    }

    data.bundles[id] = {
      ...existing,
      members: [...members],
      updatedAt: new Date().toISOString(),
    };
    this.save(data);
  }

  updateBundleTimestamp(id: string): void {
    const data = this.load();
    if (!data.bundles[id]) {
      return;
    }

    data.bundles[id] = {
      ...data.bundles[id],
      updatedAt: new Date().toISOString(),
    };
    this.save(data);
  }

  removeBundle(id: string): void {
    const data = this.load();
    delete data.bundles[id];
    this.save(data);
  }

  rebindLocalBundle(oldBundleId: string, newUrl: string): { newBundleId: string } {
    const oldUrl = oldBundleId.replace(/^local-batch:/, '');
    const normalizedOldUrl = normalizeLocalPath(oldUrl);
    const normalizedNewUrl = normalizeLocalPath(newUrl);
    const found = this.findPhysicalGroupByUrl(normalizedOldUrl);

    if (!found) {
      throw new Error(`Local bundle not found: ${oldBundleId}`);
    }

    this.groupsService.setPhysicalGroupSourceUrl(found.name, normalizedNewUrl);

    const data = this.load();
    const now = new Date().toISOString();

    for (const [key, source] of Object.entries(data.sources)) {
      if (source.installMethod !== 'local-copy') {
        continue;
      }
      if (!key.startsWith(`custom/${found.name}/`)) {
        continue;
      }

      data.sources[key] = {
        ...source,
        url: normalizedNewUrl,
        updatedAt: now,
      };
    }

    this.save(data);

    return { newBundleId: makeBundleId('local-batch', normalizedNewUrl) };
  }

  rebindLocalSource(sourceKey: string, newUrl: string): void {
    const data = this.load();
    const source = data.sources[sourceKey];
    if (!source) {
      throw new Error(`Local source not found: ${sourceKey}`);
    }

    data.sources[sourceKey] = {
      ...source,
      url: normalizeLocalPath(newUrl),
      updatedAt: new Date().toISOString(),
    };
    this.save(data);
  }

  findPhysicalGroupsByBasename(
    basename: string,
  ): Array<{ name: string; group: Extract<GroupEntry, { kind: 'local-batch' }> }> {
    return this.groupsService.findPhysicalGroupsByBasename(basename);
  }

  findBundleByUrl(normalizedUrl: string, type: BundleType): Bundle | undefined {
    if (type === 'local-batch') {
      const found = this.findPhysicalGroupByUrl(normalizeLocalPath(normalizedUrl));
      if (!found) {
        return undefined;
      }
      return this.createLocalBatchBundleFromGroup(found.name, found.group);
    }

    return this.getBundle(makeBundleId(type, normalizedUrl));
  }

  renameCustomGroupSources(oldName: string, newName: string): void {
    const oldPrefix = `custom/${oldName}/`;
    const newPrefix = `custom/${newName}/`;
    const data = this.load();
    const now = new Date().toISOString();
    let changed = false;

    const sources = Object.entries(data.sources).reduce<Record<string, SourceInfo>>(
      (acc, [key, info]) => {
        if (!key.startsWith(oldPrefix)) {
          return {
            ...acc,
            [key]: info,
          };
        }

        changed = true;
        return {
          ...acc,
          [`${newPrefix}${key.slice(oldPrefix.length)}`]: {
            ...info,
            updatedAt: now,
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
      sources,
    });
  }

  rebindPhysicalGroupSources(name: string, newUrl: string): void {
    const data = this.load();
    const now = new Date().toISOString();
    const normalizedNewUrl = normalizeLocalPath(newUrl);
    let changed = false;

    const sources = Object.entries(data.sources).reduce<Record<string, SourceInfo>>(
      (acc, [key, info]) => {
        if (!key.startsWith(`custom/${name}/`)) {
          return {
            ...acc,
            [key]: info,
          };
        }

        changed = true;
        return {
          ...acc,
          [key]: {
            ...info,
            url: normalizedNewUrl,
            updatedAt: now,
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
      sources,
    });
  }
}

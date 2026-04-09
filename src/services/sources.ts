import { renameSync, rmSync } from 'fs';
import { basename as pathBasename, dirname, join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import type {
  Bundle,
  BundleInfo,
  BundleType,
  SourcesData,
} from '../types.js';
import { ensureDir, fileExists, readFileContent, writeFile } from '../utils/fs.js';
import {
  makeBundleId,
  normalizeGitUrl,
  normalizeLocalPath,
} from '../utils/url-normalize.js';

function getSourcesFile(): string {
  return join(SKILLS_MANAGER_DIR, 'sources.json');
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

type StoredSourcesData = Omit<SourcesData, 'sources'> & {
  sources: Record<string, SourceInfo>;
};

export class SourcesService {
  private load(): StoredSourcesData {
    const sourcesFile = getSourcesFile();

    if (!fileExists(sourcesFile)) {
      return { version: '2.0', sources: {}, bundles: {} };
    }

    const parsed = JSON.parse(readFileContent(sourcesFile)) as
      | Partial<StoredSourcesData>
      | SourcesDataV1;
    const normalized = this.normalizeLoadedData(parsed);

    if (parsed.version === '2.0' && parsed.bundles !== undefined) {
      return normalized;
    }

    const migrated = this.migrateV1ToV2(parsed as SourcesDataV1);
    try {
      this.save(migrated);
    } catch {
      return migrated;
    }

    return migrated;
  }

  private save(data: StoredSourcesData): void {
    const sourcesFile = getSourcesFile();
    const tempFile = `${sourcesFile}.tmp`;

    ensureDir(dirname(sourcesFile));

    try {
      writeFile(tempFile, JSON.stringify(data, null, 2));
      renameSync(tempFile, sourcesFile);
    } catch (error) {
      if (fileExists(tempFile)) {
        rmSync(tempFile, { force: true });
      }
      throw error;
    }
  }

  private normalizeLoadedData(
    data: Partial<StoredSourcesData> | SourcesDataV1,
  ): StoredSourcesData {
    return {
      version: data.version === '1.0' ? '1.0' : '2.0',
      sources: data.sources ?? {},
      bundles: data.bundles ?? {},
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

  addSource(key: string, info: Omit<SourceInfo, 'installedAt' | 'updatedAt'>): void {
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

  addBundle(
    id: string,
    info: Omit<BundleInfo, 'installedAt' | 'updatedAt'>,
  ): void {
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
    const data = this.load();
    const bundle = data.bundles[oldBundleId];
    if (!bundle || bundle.type !== 'local-batch') {
      throw new Error(`Local bundle not found: ${oldBundleId}`);
    }

    const normalizedUrl = normalizeLocalPath(newUrl);
    const newBundleId = makeBundleId('local-batch', normalizedUrl);
    const now = new Date().toISOString();
    const reboundBundle: Bundle = {
      ...bundle,
      url: normalizedUrl,
      updatedAt: now,
    };
    const danglingMembers = bundle.members.filter((member) => data.sources[member] === undefined);

    if (danglingMembers.length > 0) {
      throw new Error(
        `Cannot rebind bundle ${oldBundleId}: dangling members in sources.json: ` +
          `${danglingMembers.join(', ')}. Clean up sources.json and retry.`,
      );
    }

    for (const member of bundle.members) {
      const source = data.sources[member]!;
      data.sources[member] = {
        ...source,
        url: normalizedUrl,
        updatedAt: now,
      };
    }

    delete data.bundles[oldBundleId];
    data.bundles[newBundleId] = reboundBundle;
    this.save(data);

    return { newBundleId };
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

  findLocalBatchBundlesByBasename(basename: string): Array<{ id: string; bundle: Bundle }> {
    return Object.entries(this.getAllBundles())
      .filter(([, bundle]) =>
        bundle.type === 'local-batch' &&
        pathBasename(normalizeLocalPath(bundle.url)) === basename
      )
      .map(([id, bundle]) => ({ id, bundle }));
  }

  findLocalCopySourcesByBasename(
    basename: string,
  ): Array<{ key: string; info: SourceInfo }> {
    return Object.entries(this.getAllSources())
      .filter(([key, info]) =>
        info.installMethod === 'local-copy' &&
        info.repoName === basename &&
        key.split('/').length === 2
      )
      .map(([key, info]) => ({ key, info }));
  }

  findBundleByUrl(normalizedUrl: string, type: BundleType): Bundle | undefined {
    return this.getBundle(makeBundleId(type, normalizedUrl));
  }
}

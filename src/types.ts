import { ToolName, SkillSource } from './constants.js';

export { ToolName, SkillSource };

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: string; // e.g., "official/anthropic" or "community/awesome-skills"
}

export interface DeployedSkill {
  name: string;
  source: string;
  deployMode: 'link' | 'copy';
}


export interface ToolConfig {
  name: ToolName;
  displayName: string;
  skillsDir: string;
  globalSkillsDir: string;
  supportsLink: boolean;
  native: boolean;
  symlinkDir?: string;
  showInList: boolean;
}

export interface InstallOptions {
  all?: boolean;
  y?: boolean;
  custom?: boolean;
  force?: boolean;
  group?: string;
  skill?: string[];
  json?: boolean;
  from?: string;
}

export interface DeployOptions {
  copy?: boolean;
  global?: boolean;
  json?: boolean;
  y?: boolean;
  sameAgents?: boolean;
  agent?: string[];
  skill?: string[];
  all?: boolean;
  followGroup?: string[];
  refresh?: boolean;
}

export interface AddOptions {
  copy?: boolean;
  agent?: string[];
  sameAgents?: boolean;
  skill?: string[];
  global?: boolean;
  group?: string;
  all?: boolean;
  y?: boolean;
  json?: boolean;
  from?: string;
}

export interface RemoveOptions {
  skill?: string[];
  global?: boolean;
  agent?: string[];
  sameAgents?: boolean;
  all?: boolean;
  y?: boolean;
  group?: string;
  json?: boolean;
  from?: string;
}

export interface ListOptions {
  deployed?: boolean;
  json?: boolean;
}

export type GroupKind = 'virtual' | 'local-batch';

export interface VirtualGroupEntry {
  kind: 'virtual';
  members: string[];
}

export interface LocalBatchGroupEntry {
  kind: 'local-batch';
  url: string;
  installedAt: string;
  updatedAt: string;
}

export type GroupEntry = VirtualGroupEntry | LocalBatchGroupEntry;

export interface GroupsDataV2 {
  version: '2.0';
  groups: Record<string, GroupEntry>;
}

export type BundleType = 'local-batch' | 'git' | 'zip';
export type RemoteBundleType = Exclude<BundleType, 'local-batch'>;

export type SelectionMode = 'all' | 'subset';

export interface BundleInfo {
  type: BundleType;
  url: string;
  selectionMode: SelectionMode;
  members: string[];
  installedAt: string;
  updatedAt: string;
}

export type Bundle = BundleInfo;

export interface RemoteBundleInfo extends Omit<BundleInfo, 'type'> {
  type: RemoteBundleType;
}

export interface SourcesDataV2 {
  version: '2.0';
  sources: Record<string, unknown>;
  bundles: Record<string, Bundle>;
}

export interface SourcesDataV3 {
  version: '3.0';
  sources: Record<string, unknown>;
  bundles: Record<string, RemoteBundleInfo>;
}

export type SourcesData = SourcesDataV2 | SourcesDataV3;

export interface LegacySourcesData {
  version: '1.0' | '2.0';
  sources: Record<string, unknown>;
  bundles: Record<string, Bundle>;
}

export interface Companion {
  source: string;
  agentTargets: Record<string, string>;
}

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  main?: string;
  keywords?: string[];
  author?: string;
  license?: string;
  engines?: Record<string, string>;
  dependencies?: string[];
  targetAgents?: string[];
  companions?: Companion[];
}

export interface PackumentVersion {
  name: string;
  version: string;
  description: string;
  manifest: SkillManifest;
  dist: {
    tarball: string;
    shasum?: string;
  };
}

export interface Packument {
  name: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, PackumentVersion>;
  time?: Record<string, string>;
}

export interface PublishPayload {
  version: string;
  description: string;
  manifest: SkillManifest;
  tarball: string;
}

export interface SearchResultObject {
  package: {
    name: string;
    version: string;
    description: string;
    author?: { name: string };
    keywords?: string[];
    date?: string;
  };
  score?: {
    detail?: {
      popularity?: number;
    };
  };
}

export interface SearchResult {
  objects: SearchResultObject[];
  total: number;
}

export interface AuthInfo {
  token: string;
  username: string;
}

export interface CollectionResolveRequest {
  extends?: string[];
  skills?: string[];
}

export type CollectionWarningKind = 'missing' | 'private-skipped' | 'cycle' | 'depth';

export interface CollectionWarning {
  kind: CollectionWarningKind;
  detail: string;
}

export interface CollectionMember {
  packageName: string;
  pinnedVersion: string | null;
  source: string;
}

export interface CollectionResolveResponse {
  members: CollectionMember[];
  warnings: CollectionWarning[];
}

export function collect(val: string, acc: string[]): string[] {
  return [...acc, val];
}

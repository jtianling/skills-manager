import { basename, join } from 'path';
import { findOfficialProvider, SKILLS_MANAGER_DIR } from '../constants.js';
import { GitHubService } from './github.js';
import { SourceInfo, SourcesService } from './sources.js';
import { SkillsService } from './skills.js';
import { GroupEntry, Bundle, GroupKind, SkillInfo } from '../types.js';
import {
  detectSourceType,
  extractOwnerRepo,
  parseOwnerRepoSkill,
  parseRegistryInput,
} from '../utils/source-detection.js';
import { fileExists, getDirectoriesInDir } from '../utils/fs.js';
import { resolveSkillByName } from '../utils/skill-resolve.js';
import {
  makeBundleId,
  normalizeGitUrl,
  normalizeLocalPath,
} from '../utils/url-normalize.js';
import { GroupsService } from './groups.js';

export type ResolvedTargetKind =
  | 'source'
  | 'skill'
  | 'bundle'
  | 'group'
  | 'rebind-candidate'
  | 'not-found';

type LocalStructureType = 'single' | 'batch';

export interface ResolvedTarget {
  kind: ResolvedTargetKind;
  sourceKeys: string[];
  skills?: SkillInfo[];
  bundleId?: string;
  groupName?: string;
  groupKind?: GroupKind;
  groupUrl?: string;
  members?: string[];
  reason?: string;
  originalInput: string;
  requestedVersion?: string;
  candidateType?: 'source' | 'group';
  candidateKey?: string;
  candidateUrl?: string;
  newAbsolutePath?: string;
  candidateStructureType?: LocalStructureType;
}

function createTarget(
  input: string,
  kind: ResolvedTargetKind,
  sourceKeys: string[],
  options: Partial<Omit<ResolvedTarget, 'kind' | 'sourceKeys' | 'originalInput'>>,
): ResolvedTarget {
  return {
    kind,
    sourceKeys,
    originalInput: input,
    ...options,
  };
}

export class SourceResolver {
  constructor(
    private readonly sourcesService: SourcesService = new SourcesService(),
    private readonly skillsService: SkillsService = new SkillsService(
      SKILLS_MANAGER_DIR
    ),
    private readonly githubService: GitHubService = new GitHubService(),
    private readonly groupsService: GroupsService = new GroupsService(),
  ) {}

  async resolve(input: string): Promise<ResolvedTarget> {
    const sourceType = detectSourceType(input);

    switch (sourceType) {
      case 'owner-repo-skill': {
        const parsed = parseOwnerRepoSkill(input);
        if (!parsed) {
          return createTarget(input, 'not-found', [], {
            reason: `Unable to parse owner/repo:skill input: ${input}`,
          });
        }
        return this.resolveOwnerRepoSkill(parsed.owner, parsed.repo, parsed.skillName, input);
      }
      case 'remote-url':
        return this.resolveUrl(input);
      case 'owner-repo': {
        const normalized = input.replace(/\/+$/, '');
        const [owner, repo] = normalized.split('/');
        return this.resolveOwnerRepo(owner, repo, input);
      }
      case 'local-path':
        return this.resolveLocalPath(input);
      case 'registry':
        return this.resolveRegistry(input);
      case 'unknown':
        return this.resolveBareword(input);
      case 'local-zip':
      case 'remote-zip':
        return createTarget(input, 'not-found', [], {
          reason: 'Zip sources require manual reinstall',
        });
      default: {
        const exhaustive: never = sourceType;
        return exhaustive;
      }
    }
  }

  private getAllSources(): Record<string, SourceInfo> {
    return this.sourcesService.getAllSources();
  }

  private getAllSkills(): SkillInfo[] {
    return this.skillsService.getAllSkills();
  }

  private getGroup(name: string): GroupEntry | null {
    return this.groupsService.getGroup(name);
  }

  private createGroupTarget(
    input: string,
    groupName: string,
    group: GroupEntry,
  ): ResolvedTarget {
    const members = this.groupsService.getGroupMembers(groupName);
    return createTarget(input, 'group', members, {
      groupName,
      groupKind: group.kind,
      groupUrl: group.kind === 'local-batch' ? group.url : undefined,
      members,
    });
  }

  private maybeWarnGroupSkillDisambiguation(groupName: string): void {
    const matchingSkill = this.getAllSkills().find((skill) => skill.name === groupName);
    if (!matchingSkill) {
      return;
    }

    console.error(
      `Disambiguation: '${groupName}' matches a group and a skill. ` +
      `Using the group. Use '${matchingSkill.source}/${matchingSkill.name}' to target the skill.`,
    );
  }

  private findSourceByNormalizedUrl(url: string): string[] {
    const normalizedInput = normalizeGitUrl(url);
    if (!normalizedInput) {
      return [];
    }

    return Object.entries(this.getAllSources())
      .filter(([, info]) => normalizeGitUrl(info.url) === normalizedInput)
      .map(([key]) => key);
  }

  private findPhysicalGroupByUrl(
    absolutePath: string,
  ): { name: string; group: Extract<GroupEntry, { kind: 'local-batch' }> } | null {
    for (const name of this.groupsService.listGroups()) {
      const group = this.groupsService.getGroup(name);
      if (!group || group.kind !== 'local-batch') {
        continue;
      }

      if (normalizeLocalPath(group.url) === absolutePath) {
        return { name, group };
      }
    }

    return null;
  }

  private resolveOwnerRepo(
    owner: string,
    repo: string,
    originalInput: string = `${owner}/${repo}`
  ): ResolvedTarget {
    if (owner === 'custom') {
      const group = this.getGroup(repo);
      if (group) {
        return this.createGroupTarget(originalInput, repo, group);
      }
    }

    const bundle = this.sourcesService.findBundleByUrl(
      `https://github.com/${owner}/${repo}`,
      'git',
    );
    if (bundle) {
      return this.createBundleTarget(originalInput, bundle, makeBundleId('git', bundle.url));
    }

    const allSources = this.getAllSources();
    const providerKey = findOfficialProvider(owner);

    if (providerKey) {
      const officialKey = `official/${providerKey}/${repo}`;
      if (allSources[officialKey]) {
        return createTarget(originalInput, 'source', [officialKey], {});
      }
    }

    const communityKey = `community/${owner}/${repo}`;
    if (allSources[communityKey]) {
      return createTarget(originalInput, 'source', [communityKey], {});
    }

    const fallback = Object.entries(allSources)
      .filter(([, info]) => extractOwnerRepo(info.url) === `${owner}/${repo}`)
      .map(([key]) => key);
    if (fallback.length > 0) {
      return createTarget(originalInput, 'source', fallback, {});
    }

    return createTarget(originalInput, 'not-found', [], {
      reason: `No installed source found for ${owner}/${repo}`,
    });
  }

  private async resolveOwnerRepoSkill(
    owner: string,
    repo: string,
    skillName: string,
    originalInput: string = `${owner}/${repo}:${skillName}`
  ): Promise<ResolvedTarget> {
    const sourceTarget = this.resolveOwnerRepo(owner, repo, originalInput);
    if (sourceTarget.kind !== 'source') {
      return sourceTarget;
    }

    const matchedSkills = this.getAllSkills().filter(
      (skill) =>
        sourceTarget.sourceKeys.includes(skill.source) && skill.name === skillName
    );

    if (matchedSkills.length === 0) {
      return createTarget(originalInput, 'not-found', [], {
        reason: `Skill '${skillName}' is not installed under ${owner}/${repo}`,
      });
    }

    return createTarget(originalInput, 'skill', sourceTarget.sourceKeys, {
      skills: matchedSkills,
    });
  }

  private async resolveUrl(url: string): Promise<ResolvedTarget> {
    const normalizedUrl = normalizeGitUrl(url);
    if (normalizedUrl) {
      const bundle = this.sourcesService.findBundleByUrl(normalizedUrl, 'git');
      if (bundle) {
        return this.createBundleTarget(url, bundle, makeBundleId('git', bundle.url));
      }
    }

    const parsed = this.githubService.parseGitHubUrl(url);
    if (parsed) {
      return this.resolveOwnerRepo(parsed.owner, parsed.repo, url);
    }

    const matchedKeys = this.findSourceByNormalizedUrl(url);
    if (matchedKeys.length > 0) {
      return createTarget(url, 'source', matchedKeys, {});
    }

    return createTarget(url, 'not-found', [], {
      reason: `No installed source found for URL: ${url}`,
    });
  }

  private resolveLocalPath(input: string): ResolvedTarget {
    const absolutePath = normalizeLocalPath(input);
    if (!fileExists(absolutePath)) {
      return createTarget(input, 'not-found', [], {
        reason: `No installed skill found from path: ${absolutePath}`,
      });
    }

    const rootSkillMd = join(absolutePath, 'SKILL.md');
    if (fileExists(rootSkillMd)) {
      const matchedKeys = Object.entries(this.getAllSources())
        .filter(
          ([, info]) =>
            info.installMethod === 'local-copy' &&
            normalizeLocalPath(info.url) === absolutePath
        )
        .map(([key]) => key);

      if (matchedKeys.length > 0) {
        return createTarget(input, 'source', matchedKeys, {});
      }
      return this.resolveLocalRebindCandidate(input, absolutePath, 'single');
    }

    const hasNestedSkills = getDirectoriesInDir(absolutePath).some((dir) =>
      fileExists(join(dir.path, 'SKILL.md'))
    );
    if (hasNestedSkills) {
      const physicalGroup = this.findPhysicalGroupByUrl(absolutePath);
      if (physicalGroup) {
        return this.createGroupTarget(input, physicalGroup.name, physicalGroup.group);
      }
      return this.resolveLocalRebindCandidate(input, absolutePath, 'batch');
    }

    return this.resolveLocalRebindCandidate(input, absolutePath, null);
  }

  private resolveRegistry(input: string): ResolvedTarget {
    const parsed = parseRegistryInput(input);
    if (!parsed) {
      return createTarget(input, 'not-found', [], {
        reason: `Invalid registry package input: ${input}`,
      });
    }

    const sourceKey = `registry/${parsed.packageName}`;
    if (!this.getAllSources()[sourceKey]) {
      return createTarget(input, 'not-found', [], {
        reason: `No installed registry source found for ${parsed.packageName}`,
        requestedVersion: parsed.requestedVersion,
      });
    }

    return createTarget(input, 'source', [sourceKey], {
      requestedVersion: parsed.requestedVersion,
    });
  }

  private async resolveBareword(input: string): Promise<ResolvedTarget> {
    const attempts: string[] = [];
    const group = this.getGroup(input);
    if (group) {
      this.maybeWarnGroupSkillDisambiguation(input);
      return this.createGroupTarget(input, input, group);
    }

    const parsedRegistry = parseRegistryInput(input);
    if (parsedRegistry) {
      attempts.push(`registry/${parsedRegistry.packageName}`);
      const registryTarget = this.resolveRegistry(input);
      if (registryTarget.kind !== 'not-found') {
        return registryTarget;
      }
    }

    const allSources = this.getAllSources();
    const suffixKey = Object.keys(allSources).find(
      (key) => key === input || key.endsWith(`/${input}`)
    );
    attempts.push(`source key suffix: ${input}`);
    if (suffixKey) {
      const matchingSkills = this.getAllSkills().filter((skill) => skill.name === input);
      const matchingSources = new Set(matchingSkills.map((skill) => skill.source));
      if (matchingSources.size > 1) {
        const resolvedSkill = await resolveSkillByName(input, matchingSkills);
        if (resolvedSkill) {
          return createTarget(input, 'skill', [resolvedSkill.source], {
            skills: [resolvedSkill],
          });
        }
      }

      return createTarget(input, 'source', [suffixKey], {});
    }

    const repoNameKey = Object.entries(allSources).find(
      ([, info]) => info.repoName === input
    )?.[0];
    attempts.push(`repoName: ${input}`);
    if (repoNameKey) {
      return createTarget(input, 'source', [repoNameKey], {});
    }

    attempts.push(`skill name: ${input}`);
    const resolvedSkill = await resolveSkillByName(input, this.getAllSkills());
    if (resolvedSkill) {
      return createTarget(input, 'skill', [resolvedSkill.source], {
        skills: [resolvedSkill],
      });
    }

    return createTarget(input, 'not-found', [], {
      reason: `No installed source found. Tried: ${attempts.join(', ')}`,
    });
  }

  private createBundleTarget(
    input: string,
    bundle: Bundle,
    bundleId: string,
  ): ResolvedTarget {
    return createTarget(input, 'bundle', [...bundle.members], {
      bundleId,
    });
  }

  private resolveLocalRebindCandidate(
    input: string,
    absolutePath: string,
    detectedStructureType: LocalStructureType | null,
  ): ResolvedTarget {
    const lookupBasename = basename(absolutePath);
    const groupCandidates = this.sourcesService
      .findPhysicalGroupsByBasename(lookupBasename)
      .map(({ name, group }) => ({
        candidateType: 'group' as const,
        candidateKey: name,
        candidateUrl: normalizeLocalPath(group.url),
        candidateStructureType: 'batch' as const,
      }));
    const sourceCandidates = this.sourcesService
      .findLocalCopySourcesByBasename(lookupBasename)
      .map(({ key, info }) => ({
        candidateType: 'source' as const,
        candidateKey: key,
        candidateUrl: normalizeLocalPath(info.url),
        candidateStructureType: 'single' as const,
      }));
    const candidates = [...groupCandidates, ...sourceCandidates];

    if (candidates.length === 0) {
      return createTarget(input, 'not-found', [], {
        reason: `No installed skill found from path: ${absolutePath}`,
      });
    }

    if (candidates.length > 1) {
      const lines = candidates
        .map((candidate) => `  - ${candidate.candidateKey}: ${candidate.candidateUrl}`)
        .join('\n');
      return createTarget(input, 'not-found', [], {
        reason:
          `No installed skill found from path: ${absolutePath}. ` +
          `Multiple installed local sources share basename '${lookupBasename}':\n${lines}`,
      });
    }

    const [candidate] = candidates;
    if (fileExists(candidate.candidateUrl)) {
      const noun = candidate.candidateType === 'group' ? 'group' : 'skill';
      return createTarget(input, 'not-found', [], {
        reason:
          `No installed skill found from path: ${absolutePath}. ` +
          `A ${noun} with the same name is installed from ${candidate.candidateUrl} ` +
          `(still exists). Remove or rename the old path first to rebind.`,
      });
    }

    if (detectedStructureType !== candidate.candidateStructureType) {
      return createTarget(input, 'not-found', [], {
        reason: this.createPathTypeMismatchReason(candidate, absolutePath, detectedStructureType),
      });
    }

    return createTarget(input, 'rebind-candidate', [], {
      candidateType: candidate.candidateType,
      candidateKey: candidate.candidateKey,
      candidateUrl: candidate.candidateUrl,
      newAbsolutePath: absolutePath,
      candidateStructureType: candidate.candidateStructureType,
    });
  }

  private createPathTypeMismatchReason(
    candidate: {
      candidateType: 'source' | 'group';
      candidateKey: string;
      candidateUrl: string;
      candidateStructureType: LocalStructureType;
    },
    absolutePath: string,
    detectedStructureType: LocalStructureType | null,
  ): string {
    const existingName = basename(candidate.candidateUrl);
    const existingType = candidate.candidateStructureType === 'batch'
      ? 'batch'
      : 'single skill';
    const detectedType = detectedStructureType === 'batch'
      ? 'a batch'
      : detectedStructureType === 'single'
        ? 'a single skill'
        : 'neither a single skill nor a batch';
    const noun = candidate.candidateType === 'group' ? 'group' : 'skill';

    return (
      `Path type mismatch: existing ${noun} '${existingName}' is ${existingType}, ` +
      `but ${absolutePath} looks like ${detectedType}.`
    );
  }
}

import { join } from 'path';
import { findOfficialProvider, SKILLS_MANAGER_DIR } from '../constants.js';
import { GitHubService } from './github.js';
import { SourceInfo, SourcesService } from './sources.js';
import { SkillsService } from './skills.js';
import { Bundle, SkillInfo } from '../types.js';
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

export type ResolvedTargetKind = 'source' | 'skill' | 'bundle' | 'not-found';

export interface ResolvedTarget {
  kind: ResolvedTargetKind;
  sourceKeys: string[];
  skills?: SkillInfo[];
  bundleId?: string;
  reason?: string;
  originalInput: string;
  requestedVersion?: string;
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
    private readonly githubService: GitHubService = new GitHubService()
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

  private findSourceByNormalizedUrl(url: string): string[] {
    const normalizedInput = normalizeGitUrl(url);
    if (!normalizedInput) {
      return [];
    }

    return Object.entries(this.getAllSources())
      .filter(([, info]) => normalizeGitUrl(info.url) === normalizedInput)
      .map(([key]) => key);
  }

  private resolveOwnerRepo(
    owner: string,
    repo: string,
    originalInput: string = `${owner}/${repo}`
  ): ResolvedTarget {
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

      return createTarget(input, 'not-found', [], {
        reason: `No installed skill found from path: ${absolutePath}`,
      });
    }

    const hasNestedSkills = getDirectoriesInDir(absolutePath).some((dir) =>
      fileExists(join(dir.path, 'SKILL.md'))
    );
    if (hasNestedSkills) {
      const bundle = this.sourcesService.findBundleByUrl(absolutePath, 'local-batch');
      if (bundle) {
        return this.createBundleTarget(
          input,
          bundle,
          makeBundleId('local-batch', absolutePath),
        );
      }

      return createTarget(input, 'not-found', [], {
        reason: `No installed skill found from path: ${absolutePath}`,
      });
    }

    return createTarget(input, 'not-found', [], {
      reason: `No installed skill found from path: ${absolutePath}`,
    });
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
}

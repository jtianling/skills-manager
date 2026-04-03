export type SourceType =
  | 'remote-zip'
  | 'local-zip'
  | 'remote-url'
  | 'owner-repo'
  | 'owner-repo-skill'
  | 'local-path'
  | 'registry'
  | 'unknown';

export interface RegistryDetectedSource {
  type: 'registry';
  packageName: string;
  requestedVersion?: string;
}

const BARE_PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const SCOPED_PACKAGE_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

export function parseRegistryInput(input: string): RegistryDetectedSource | null {
  // Don't match URLs, local paths, or owner/repo patterns
  if (input.includes('://') || input.startsWith('git@')) return null;
  if (hasExplicitLocalPrefix(input)) return null;

  // Scoped package: @scope/name or @scope/name@version
  if (input.startsWith('@')) {
    const versionSplit = input.match(/^(@[^@]+)@(.+)$/);
    if (versionSplit) {
      const name = versionSplit[1];
      const version = versionSplit[2];
      if (SCOPED_PACKAGE_PATTERN.test(name)) {
        return { type: 'registry', packageName: name, requestedVersion: version };
      }
    }
    if (SCOPED_PACKAGE_PATTERN.test(input)) {
      return { type: 'registry', packageName: input };
    }
    return null;
  }

  // Don't match owner/repo (contains / but doesn't start with @)
  if (input.includes('/')) return null;

  // Bare package: name or name@version
  const atIndex = input.indexOf('@');
  if (atIndex > 0) {
    const name = input.substring(0, atIndex);
    const version = input.substring(atIndex + 1);
    if (BARE_PACKAGE_NAME_PATTERN.test(name) && version.length > 0) {
      return { type: 'registry', packageName: name, requestedVersion: version };
    }
  }

  if (BARE_PACKAGE_NAME_PATTERN.test(input)) {
    return { type: 'registry', packageName: input };
  }

  return null;
}

const LOCAL_PATH_PREFIXES = ['/', './', '../', '~/'];
const OWNER_REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*\/?$/;
const OWNER_REPO_SKILL_PATTERN = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\/([A-Za-z0-9][A-Za-z0-9_.-]*):(.+)$/;

export interface OwnerRepoSkillDetectedSource {
  type: 'owner-repo-skill';
  owner: string;
  repo: string;
  skillName: string;
}

export function parseOwnerRepoSkill(input: string): OwnerRepoSkillDetectedSource | null {
  const match = input.match(OWNER_REPO_SKILL_PATTERN);
  if (!match) return null;
  return { type: 'owner-repo-skill', owner: match[1], repo: match[2], skillName: match[3] };
}
const ZIP_LIKE_EXTENSIONS = ['.zip', '.skill'];

export function isZipLikeExtension(input: string): boolean {
  return ZIP_LIKE_EXTENSIONS.some((ext) => input.endsWith(ext));
}

export function hasExplicitLocalPrefix(input: string): boolean {
  return input === '~' || LOCAL_PATH_PREFIXES.some((prefix) => input.startsWith(prefix));
}

export function extractOwnerRepo(input: string): string | null {
  const trimmed = input.replace(/\/+$/, '');

  if (OWNER_REPO_PATTERN.test(input)) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return null;
      const repo = segments[1].replace(/\.git$/, '');
      return `${segments[0]}/${repo}`;
    } catch {
      return null;
    }
  }

  const sshMatch = trimmed.match(/^git@[^:]+:(.+)$/);
  if (sshMatch) {
    const path = sshMatch[1].replace(/\.git$/, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    return `${segments[0]}/${segments[1]}`;
  }

  return null;
}

export function detectSourceType(input: string): SourceType {
  if ((input.startsWith('http://') || input.startsWith('https://')) && isZipLikeExtension(input)) {
    return 'remote-zip';
  }

  if (isZipLikeExtension(input) && hasExplicitLocalPrefix(input)) {
    return 'local-zip';
  }

  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('git@')) {
    return 'remote-url';
  }

  if (parseOwnerRepoSkill(input)) {
    return 'owner-repo-skill';
  }

  if (OWNER_REPO_PATTERN.test(input)) {
    return 'owner-repo';
  }

  if (hasExplicitLocalPrefix(input)) {
    return 'local-path';
  }

  if (parseRegistryInput(input)) {
    return 'registry';
  }

  return 'unknown';
}

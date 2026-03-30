export type SourceType =
  | 'remote-zip'
  | 'local-zip'
  | 'remote-url'
  | 'owner-repo'
  | 'local-path'
  | 'unknown';

const LOCAL_PATH_PREFIXES = ['/', './', '../', '~/'];
const OWNER_REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*\/?$/;
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

  if (OWNER_REPO_PATTERN.test(input)) {
    return 'owner-repo';
  }

  if (hasExplicitLocalPrefix(input)) {
    return 'local-path';
  }

  return 'unknown';
}

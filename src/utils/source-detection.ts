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

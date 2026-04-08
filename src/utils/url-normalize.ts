import { homedir } from 'os';
import { join, resolve as resolvePath } from 'path';
import type { BundleType } from '../types.js';

function expandHomePath(input: string): string {
  if (input === '~') {
    return homedir();
  }

  if (input.startsWith('~/')) {
    return join(homedir(), input.slice(2));
  }

  return input;
}

export function normalizeGitUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');

  const sshMatch = trimmed.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    const repoPath = sshMatch[2].replace(/\.git$/, '').replace(/\/+$/, '');
    return `https://${host}/${repoPath}`;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');
    return `https://${parsed.host.toLowerCase()}${pathname}`;
  } catch {
    return null;
  }
}

export function normalizeLocalPath(input: string): string {
  const expanded = expandHomePath(input);
  if (expanded.startsWith('/')) {
    return expanded;
  }

  return resolvePath(process.cwd(), expanded);
}

export function makeBundleId(type: BundleType, normalizedUrl: string): string {
  return `${type}:${normalizedUrl}`;
}

import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../../constants.js';

/**
 * Directory- and key-safe form of a well-known host: lowercased, with the
 * port separator replaced because ':' is unsafe on some filesystems.
 */
export function normalizeWellKnownHost(origin: string): string {
  return new URL(origin).host.toLowerCase().replace(/:/g, '_');
}

export function wellKnownSourceKey(host: string): string {
  return `well-known/${host}`;
}

export function getWellKnownInstallDir(host: string): string {
  return join(SKILLS_MANAGER_DIR, 'well-known', host);
}

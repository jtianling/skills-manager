import { chmodSync } from 'fs';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import type { AuthInfo } from '../types.js';
import { ensureDir, fileExists, readFileContent, removeFile, writeFile } from '../utils/fs.js';

function getAuthFile(): string {
  return join(SKILLS_MANAGER_DIR, 'auth.json');
}

export function readAuth(): AuthInfo | null {
  const authFile = getAuthFile();
  if (!fileExists(authFile)) {
    return null;
  }

  try {
    const content = readFileContent(authFile);
    const data = JSON.parse(content) as AuthInfo;
    if (data.token && data.username) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAuth(auth: AuthInfo): void {
  ensureDir(SKILLS_MANAGER_DIR);
  const authFile = getAuthFile();
  writeFile(authFile, JSON.stringify(auth, null, 2));
  chmodSync(authFile, 0o600);
}

export function clearAuth(): void {
  const authFile = getAuthFile();
  removeFile(authFile);
}

export function getToken(): string | null {
  const auth = readAuth();
  return auth?.token ?? null;
}

import { join } from 'path';
import { fileExists, readFileContent } from '../utils/fs.js';
import type { SkillManifest } from '../types.js';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;
const PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const SCOPED_PACKAGE_NAME_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;
const MAX_PACKAGE_NAME_LENGTH = 214;

export function validatePackageName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Package name is required' };
  }

  if (name.length > MAX_PACKAGE_NAME_LENGTH) {
    return { valid: false, error: `Package name must be ${MAX_PACKAGE_NAME_LENGTH} characters or less` };
  }

  if (name.startsWith('@')) {
    if (!SCOPED_PACKAGE_NAME_PATTERN.test(name)) {
      return { valid: false, error: 'Invalid scoped package name. Must match @scope/name with lowercase letters, numbers, hyphens, dots' };
    }
    return { valid: true };
  }

  if (!PACKAGE_NAME_PATTERN.test(name)) {
    return { valid: false, error: 'Invalid package name. Must use lowercase letters, numbers, hyphens, dots, and start with a letter or number' };
  }

  return { valid: true };
}

export function validateManifest(manifest: SkillManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest.name) {
    errors.push('Missing required field: name');
  } else {
    const nameResult = validatePackageName(manifest.name);
    if (!nameResult.valid) {
      errors.push(nameResult.error!);
    }
  }

  if (!manifest.version) {
    errors.push('Missing required field: version');
  } else if (!SEMVER_PATTERN.test(manifest.version)) {
    errors.push(`Invalid version "${manifest.version}". Must be valid semver (e.g., 1.0.0)`);
  }

  if (!manifest.description) {
    errors.push('Missing required field: description');
  }

  return { valid: errors.length === 0, errors };
}

export function readManifest(dir: string): SkillManifest | null {
  const manifestPath = join(dir, 'skill.json');
  if (!fileExists(manifestPath)) {
    return null;
  }

  const content = readFileContent(manifestPath);
  let manifest: SkillManifest;

  try {
    manifest = JSON.parse(content) as SkillManifest;
  } catch {
    throw new Error(`Failed to parse skill.json: invalid JSON`);
  }

  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    throw new Error(`Invalid skill.json: ${errors.join(', ')}`);
  }

  return manifest;
}

import { join, isAbsolute, resolve, relative } from 'path';
import { fileExists, readFileContent } from '../utils/fs.js';
import { SUPPORTED_TOOLS } from '../constants.js';
import type { SkillManifest, Companion } from '../types.js';

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

function isKnownAgent(name: string): boolean {
  return (SUPPORTED_TOOLS as readonly string[]).includes(name);
}

function hasParentSegment(rel: string): boolean {
  const parts = rel.split(/[\\/]/).filter(Boolean);
  return parts.includes('..');
}

function validateRelativePath(p: string): string | null {
  if (typeof p !== 'string' || p.length === 0) {
    return 'must be a non-empty string';
  }
  if (isAbsolute(p)) {
    return 'must be a relative path, not absolute';
  }
  if (hasParentSegment(p)) {
    return 'must not contain ".." segments';
  }
  return null;
}

function validateTargetAgents(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('targetAgents must be a string array');
    return;
  }
  for (const entry of value) {
    if (typeof entry !== 'string') {
      errors.push('targetAgents must be a string array (found non-string element)');
      return;
    }
    if (!isKnownAgent(entry)) {
      errors.push(
        `targetAgents contains unknown agent '${entry}'. ` +
        `Known agents: ${SUPPORTED_TOOLS.join(', ')}`,
      );
    }
  }
}

function validateCompanion(
  comp: unknown,
  index: number,
  targetAgents: string[] | undefined,
  errors: string[],
): void {
  if (!comp || typeof comp !== 'object' || Array.isArray(comp)) {
    errors.push(`companions[${index}] must be an object`);
    return;
  }
  const obj = comp as Record<string, unknown>;
  const source = obj.source;
  if (typeof source !== 'string' || source.length === 0) {
    errors.push(`companions[${index}].source must be a non-empty string`);
  } else {
    const err = validateRelativePath(source);
    if (err) {
      errors.push(`companions[${index}].source ${err}`);
    }
  }

  const agentTargets = obj.agentTargets;
  if (!agentTargets || typeof agentTargets !== 'object' || Array.isArray(agentTargets)) {
    errors.push(`companions[${index}].agentTargets must be an object`);
    return;
  }
  const targetEntries = Object.entries(agentTargets as Record<string, unknown>);
  if (targetEntries.length === 0) {
    errors.push(
      `companions[${index}].agentTargets must declare at least one agent target`,
    );
    return;
  }

  const allowed = targetAgents && targetAgents.length > 0
    ? new Set(targetAgents)
    : null;

  for (const [agent, target] of targetEntries) {
    if (!isKnownAgent(agent)) {
      errors.push(
        `companions[${index}].agentTargets contains unknown agent '${agent}'. ` +
        `Known agents: ${SUPPORTED_TOOLS.join(', ')}`,
      );
      continue;
    }
    if (allowed && !allowed.has(agent)) {
      errors.push(
        `companions[${index}].agentTargets agent '${agent}' is not in skill ` +
        `targetAgents [${targetAgents!.join(', ')}]`,
      );
    }
    if (typeof target !== 'string' || target.length === 0) {
      errors.push(
        `companions[${index}].agentTargets.${agent} must be a non-empty string`,
      );
      continue;
    }
    const err = validateRelativePath(target);
    if (err) {
      errors.push(
        `companions[${index}].agentTargets.${agent} ${err} (target must stay inside project)`,
      );
    }
  }
}

function validateCompanions(
  value: unknown,
  targetAgents: string[] | undefined,
  errors: string[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push('companions must be an array');
    return;
  }
  value.forEach((comp, index) => {
    validateCompanion(comp, index, targetAgents, errors);
  });
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

  if (manifest.dependencies !== undefined) {
    if (!Array.isArray(manifest.dependencies)) {
      errors.push(
        'dependencies must be a string[]. ' +
        'The Record<string, string> format is no longer supported. ' +
        'Migrate to: "dependencies": ["package-name", "owner/repo:skillName", "owner/repo"]'
      );
    } else {
      for (const dep of manifest.dependencies) {
        if (typeof dep !== 'string') {
          errors.push(`Invalid dependency: expected string, got ${typeof dep}`);
        }
      }
    }
  }

  validateTargetAgents(manifest.targetAgents, errors);
  validateCompanions(manifest.companions, manifest.targetAgents, errors);

  return { valid: errors.length === 0, errors };
}

export interface CompanionPathCheck {
  ok: boolean;
  resolvedPath?: string;
  error?: string;
}

export function resolveCompanionSource(
  skillDir: string,
  source: string,
): CompanionPathCheck {
  const err = validateRelativePath(source);
  if (err) {
    return { ok: false, error: `source ${err}` };
  }
  const absolute = resolve(skillDir, source);
  const rel = relative(resolve(skillDir), absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return { ok: false, error: 'source must resolve inside skill directory' };
  }
  return { ok: true, resolvedPath: absolute };
}

export function resolveCompanionTarget(
  projectDir: string,
  target: string,
): CompanionPathCheck {
  const err = validateRelativePath(target);
  if (err) {
    return { ok: false, error: `target ${err}` };
  }
  const absolute = resolve(projectDir, target);
  const rel = relative(resolve(projectDir), absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return { ok: false, error: 'target must resolve inside project directory' };
  }
  return { ok: true, resolvedPath: absolute };
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

export type { Companion };

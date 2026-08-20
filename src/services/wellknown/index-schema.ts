export const DISCOVERY_SCHEMA_V2 =
  'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_NAME_LENGTH = 64;
const NAME_PATTERN = /^[a-z0-9-]+$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export type WellKnownEntry =
  | {
      version: '0.1.0';
      name: string;
      description: string;
      files: string[];
    }
  | {
      version: '0.2.0';
      name: string;
      description: string;
      type: 'skill-md' | 'archive';
      artifactUrl: string;
      digest: string;
    };

export interface DiscardedEntry {
  name: string;
  reason: string;
}

export interface IndexValidationResult {
  version: '0.1.0' | '0.2.0';
  entries: WellKnownEntry[];
  discarded: DiscardedEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entryLabel(raw: unknown): string {
  if (isRecord(raw) && typeof raw.name === 'string' && raw.name.length > 0) {
    return raw.name;
  }
  return '(unnamed)';
}

function nameError(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return 'name must be a non-empty string';
  }
  if (raw.length > MAX_NAME_LENGTH) {
    return `name exceeds ${MAX_NAME_LENGTH} characters`;
  }
  if (!NAME_PATTERN.test(raw)) {
    return 'name must match ^[a-z0-9-]+$';
  }
  if (raw.startsWith('-') || raw.endsWith('-') || raw.includes('--')) {
    return 'name must not start or end with "-" or contain "--"';
  }
  return null;
}

function descriptionError(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return 'description must be a non-empty string';
  }
  if (raw.length > MAX_DESCRIPTION_LENGTH) {
    return `description exceeds ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  return null;
}

function filesError(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return 'files must be a non-empty array';
  }

  for (const file of raw) {
    if (typeof file !== 'string' || file.length === 0) {
      return 'files entries must be non-empty strings';
    }
    if (file.startsWith('/') || file.startsWith('\\')) {
      return `files entry must be relative: ${file}`;
    }
    if (file.includes('..') || file.includes('\0') || file.includes('\\')) {
      return `files entry escapes the skill directory: ${file}`;
    }
  }

  const hasSkillMd = raw.some(
    (file) => typeof file === 'string' && file.toLowerCase() === 'skill.md',
  );
  return hasSkillMd ? null : 'files must include SKILL.md';
}

function artifactUrlError(raw: unknown, indexUrl: string): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return 'url must be a non-empty string';
  }

  let resolved: URL;
  try {
    resolved = new URL(raw, indexUrl);
  } catch {
    return `url is not resolvable: ${raw}`;
  }

  if (resolved.origin !== new URL(indexUrl).origin) {
    return `url must stay on the index origin: ${resolved.origin}`;
  }
  return null;
}

function validateV1Entry(raw: Record<string, unknown>): WellKnownEntry | string {
  const error = descriptionError(raw.description) ?? filesError(raw.files);
  if (error) {
    return error;
  }

  return {
    version: '0.1.0',
    name: raw.name as string,
    description: raw.description as string,
    files: [...(raw.files as string[])],
  };
}

function validateV2Entry(
  raw: Record<string, unknown>,
  indexUrl: string,
): WellKnownEntry | string {
  const error =
    descriptionError(raw.description) ??
    (raw.type === 'skill-md' || raw.type === 'archive'
      ? null
      : 'type must be "skill-md" or "archive"') ??
    (typeof raw.digest === 'string' && DIGEST_PATTERN.test(raw.digest)
      ? null
      : 'digest must match ^sha256:[a-f0-9]{64}$') ??
    artifactUrlError(raw.url, indexUrl);
  if (error) {
    return error;
  }

  return {
    version: '0.2.0',
    name: raw.name as string,
    description: raw.description as string,
    type: raw.type as 'skill-md' | 'archive',
    artifactUrl: new URL(raw.url as string, indexUrl).toString(),
    digest: raw.digest as string,
  };
}

/**
 * Validate a raw well-known index. Returns null when the index itself is
 * unusable (non-object, non-array skills, unknown $schema); individual bad
 * entries are dropped into `discarded` with a reason instead.
 */
export function validateIndex(
  raw: unknown,
  indexUrl: string,
): IndexValidationResult | null {
  if (!isRecord(raw) || !Array.isArray(raw.skills)) {
    return null;
  }

  const schema = raw.$schema;
  if (schema !== undefined && schema !== DISCOVERY_SCHEMA_V2) {
    return null;
  }
  const version = schema === DISCOVERY_SCHEMA_V2 ? '0.2.0' : '0.1.0';

  const entries: WellKnownEntry[] = [];
  const discarded: DiscardedEntry[] = [];

  for (const item of raw.skills) {
    const label = entryLabel(item);
    if (!isRecord(item)) {
      discarded.push({ name: label, reason: 'entry must be an object' });
      continue;
    }

    const invalidName = nameError(item.name);
    if (invalidName) {
      discarded.push({ name: label, reason: invalidName });
      continue;
    }

    const validated =
      version === '0.2.0' ? validateV2Entry(item, indexUrl) : validateV1Entry(item);
    if (typeof validated === 'string') {
      discarded.push({ name: label, reason: validated });
      continue;
    }

    entries.push(validated);
  }

  return { version, entries, discarded };
}

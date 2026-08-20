import { describe, it, expect } from 'vitest';
import { validateIndex, DISCOVERY_SCHEMA_V2 } from './index-schema.js';

const INDEX_URL = 'https://example.com/.well-known/agent-skills/index.json';

function v1Entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'alpha',
    description: 'Alpha skill',
    files: ['SKILL.md'],
    ...overrides,
  };
}

function v2Entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'alpha',
    type: 'skill-md',
    description: 'Alpha skill',
    url: 'https://example.com/skills/alpha/SKILL.md',
    digest: `sha256:${'a'.repeat(64)}`,
    ...overrides,
  };
}

describe('validateIndex', () => {
  it('accepts a legacy index without $schema as v0.1.0', () => {
    const result = validateIndex({ skills: [v1Entry()] }, INDEX_URL);

    expect(result).not.toBeNull();
    expect(result!.entries).toEqual([
      { version: '0.1.0', name: 'alpha', description: 'Alpha skill', files: ['SKILL.md'] },
    ]);
    expect(result!.discarded).toEqual([]);
  });

  it('accepts the v0.2.0 $schema and normalizes the artifact url', () => {
    const result = validateIndex(
      { $schema: DISCOVERY_SCHEMA_V2, skills: [v2Entry({ url: '/skills/alpha/SKILL.md' })] },
      INDEX_URL,
    );

    expect(result!.entries).toEqual([
      {
        version: '0.2.0',
        name: 'alpha',
        description: 'Alpha skill',
        type: 'skill-md',
        artifactUrl: 'https://example.com/skills/alpha/SKILL.md',
        digest: `sha256:${'a'.repeat(64)}`,
      },
    ]);
  });

  it('rejects the whole index on an unknown $schema', () => {
    const result = validateIndex(
      { $schema: 'https://example.com/unknown/schema.json', skills: [v1Entry()] },
      INDEX_URL,
    );

    expect(result).toBeNull();
  });

  it('rejects the whole index when the top level is not an object', () => {
    expect(validateIndex(null, INDEX_URL)).toBeNull();
    expect(validateIndex([v1Entry()], INDEX_URL)).toBeNull();
    expect(validateIndex('skills', INDEX_URL)).toBeNull();
  });

  it('rejects the whole index when skills is not an array', () => {
    expect(validateIndex({ skills: {} }, INDEX_URL)).toBeNull();
    expect(validateIndex({}, INDEX_URL)).toBeNull();
  });

  it('discards entries with an invalid name and keeps the rest', () => {
    const result = validateIndex(
      {
        skills: [
          v1Entry({ name: 'good-one' }),
          v1Entry({ name: 'My_Skill' }),
          v1Entry({ name: 'good-two' }),
        ],
      },
      INDEX_URL,
    );

    expect(result!.entries.map((e) => e.name)).toEqual(['good-one', 'good-two']);
    expect(result!.discarded).toHaveLength(1);
    expect(result!.discarded[0].reason).toContain('name');
  });

  it('discards names that are too long, edge-dashed or double-dashed', () => {
    const result = validateIndex(
      {
        skills: [
          v1Entry({ name: '-lead' }),
          v1Entry({ name: 'trail-' }),
          v1Entry({ name: 'a--b' }),
          v1Entry({ name: 'a'.repeat(65) }),
          v1Entry({ name: 'ok' }),
        ],
      },
      INDEX_URL,
    );

    expect(result!.entries.map((e) => e.name)).toEqual(['ok']);
    expect(result!.discarded).toHaveLength(4);
  });

  it('discards v0.1.0 entries whose files omit SKILL.md', () => {
    const result = validateIndex(
      { skills: [v1Entry({ files: ['references/a.md'] })] },
      INDEX_URL,
    );

    expect(result!.entries).toEqual([]);
    expect(result!.discarded[0].reason).toContain('SKILL.md');
  });

  it('matches SKILL.md case-insensitively', () => {
    const result = validateIndex({ skills: [v1Entry({ files: ['skill.md'] })] }, INDEX_URL);

    expect(result!.entries).toHaveLength(1);
  });

  it('discards v0.1.0 entries whose files escape the skill directory', () => {
    const escaping = [
      ['SKILL.md', '../../etc/passwd'],
      ['SKILL.md', '/etc/passwd'],
      ['SKILL.md', '\\windows\\system32'],
      ['SKILL.md', 'a\0b'],
    ];
    const result = validateIndex(
      { skills: escaping.map((files) => v1Entry({ files })) },
      INDEX_URL,
    );

    expect(result!.entries).toEqual([]);
    expect(result!.discarded).toHaveLength(4);
  });

  it('discards v0.1.0 entries with an empty or non-string files list', () => {
    const result = validateIndex(
      { skills: [v1Entry({ files: [] }), v1Entry({ files: [1] }), v1Entry({ files: 'SKILL.md' })] },
      INDEX_URL,
    );

    expect(result!.entries).toEqual([]);
    expect(result!.discarded).toHaveLength(3);
  });

  it('discards v0.2.0 entries whose artifact url points at another origin', () => {
    const result = validateIndex(
      {
        $schema: DISCOVERY_SCHEMA_V2,
        skills: [
          v2Entry({ name: 'evil', url: 'https://evil.example.net/a/SKILL.md' }),
          v2Entry({ name: 'safe' }),
        ],
      },
      INDEX_URL,
    );

    expect(result!.entries.map((e) => e.name)).toEqual(['safe']);
    expect(result!.discarded[0].reason).toContain('origin');
  });

  it('discards v0.2.0 entries with a bad type or digest', () => {
    const result = validateIndex(
      {
        $schema: DISCOVERY_SCHEMA_V2,
        skills: [
          v2Entry({ name: 'bad-type', type: 'tarball' }),
          v2Entry({ name: 'bad-digest', digest: 'sha1:abc' }),
          v2Entry({ name: 'upper-digest', digest: `sha256:${'A'.repeat(64)}` }),
          v2Entry({ name: 'bad-url', url: 123 }),
        ],
      },
      INDEX_URL,
    );

    expect(result!.entries).toEqual([]);
    expect(result!.discarded).toHaveLength(4);
  });

  it('discards entries whose description is missing, empty or over 1024 chars', () => {
    const result = validateIndex(
      {
        skills: [
          v1Entry({ name: 'too-long', description: 'x'.repeat(1025) }),
          v1Entry({ name: 'empty', description: '' }),
          v1Entry({ name: 'missing', description: undefined }),
          v1Entry({ name: 'at-limit', description: 'x'.repeat(1024) }),
        ],
      },
      INDEX_URL,
    );

    expect(result!.entries.map((e) => e.name)).toEqual(['at-limit']);
    expect(result!.discarded).toHaveLength(3);
  });

  it('returns zero entries when every entry is invalid', () => {
    const result = validateIndex({ skills: [v1Entry({ name: 'BAD' })] }, INDEX_URL);

    expect(result).not.toBeNull();
    expect(result!.entries).toEqual([]);
    expect(result!.discarded).toHaveLength(1);
  });
});

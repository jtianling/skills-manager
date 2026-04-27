import { describe, it, expect } from 'vitest';
import {
  validatePackageName,
  validateManifest,
  resolveCompanionSource,
  resolveCompanionTarget,
} from './manifest.js';

describe('validatePackageName', () => {
  it('accepts valid bare package names', () => {
    expect(validatePackageName('code-review')).toEqual({ valid: true });
    expect(validatePackageName('my.skill')).toEqual({ valid: true });
    expect(validatePackageName('skill123')).toEqual({ valid: true });
  });

  it('accepts valid scoped package names', () => {
    expect(validatePackageName('@anthropic/code-review')).toEqual({ valid: true });
    expect(validatePackageName('@scope/name')).toEqual({ valid: true });
  });

  it('rejects empty names', () => {
    expect(validatePackageName('')).toEqual({ valid: false, error: 'Package name is required' });
  });

  it('rejects names with uppercase', () => {
    const result = validatePackageName('My_Skill');
    expect(result.valid).toBe(false);
  });

  it('rejects names exceeding 214 characters', () => {
    const longName = 'a'.repeat(215);
    const result = validatePackageName(longName);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid scoped names', () => {
    const result = validatePackageName('@SCOPE/name');
    expect(result.valid).toBe(false);
  });
});

describe('validateManifest', () => {
  it('accepts valid minimal manifest', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing name', () => {
    const result = validateManifest({
      name: '',
      version: '1.0.0',
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: name');
  });

  it('reports missing version', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '',
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: version');
  });

  it('reports missing description', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: description');
  });

  it('reports multiple missing fields', () => {
    const result = validateManifest({
      name: '',
      version: '',
      description: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('validates package name format', () => {
    const result = validateManifest({
      name: 'INVALID_NAME!',
      version: '1.0.0',
      description: 'A skill',
    });
    expect(result.valid).toBe(false);
  });

  it('validates semver format', () => {
    expect(validateManifest({ name: 'a', version: '1.0.0', description: 'x' }).valid).toBe(true);
    expect(validateManifest({ name: 'a', version: '1.0.0-beta.1', description: 'x' }).valid).toBe(true);
    expect(validateManifest({ name: 'a', version: '1.0.0+build', description: 'x' }).valid).toBe(true);
  });

  it('rejects invalid semver', () => {
    const result = validateManifest({ name: 'a', version: 'abc', description: 'x' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid version');
  });

  it('accepts dependencies as string array', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      dependencies: ['base-prompts', 'owner/repo:skill-name', 'owner/repo'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts empty dependencies array', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      dependencies: [],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts manifest without dependencies field', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects Record<string, string> dependencies with migration hint', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      dependencies: { 'foo': '^1.0.0' } as unknown as string[],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('string[]');
    expect(result.errors[0]).toContain('no longer supported');
  });

  it('rejects non-string items in dependencies array', () => {
    const result = validateManifest({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill',
      dependencies: ['valid', 123 as unknown as string],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('expected string');
  });
});

describe('validateManifest targetAgents', () => {
  const base = { name: 'my-skill', version: '1.0.0', description: 'd' };

  it('accepts manifest without targetAgents', () => {
    expect(validateManifest({ ...base }).valid).toBe(true);
  });

  it('accepts empty targetAgents array', () => {
    expect(validateManifest({ ...base, targetAgents: [] }).valid).toBe(true);
  });

  it('accepts targetAgents with valid agent', () => {
    expect(
      validateManifest({ ...base, targetAgents: ['claude-code'] }).valid,
    ).toBe(true);
  });

  it('rejects unknown agent in targetAgents', () => {
    const r = validateManifest({
      ...base,
      targetAgents: ['unknown-agent'] as unknown as string[],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('unknown agent'))).toBe(true);
    expect(r.errors.some((e) => e.includes('Known agents'))).toBe(true);
  });

  it('rejects non-array targetAgents', () => {
    const r = validateManifest({
      ...base,
      targetAgents: 'claude-code' as unknown as string[],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('targetAgents must be a string array'))).toBe(true);
  });

  it('rejects non-string element in targetAgents', () => {
    const r = validateManifest({
      ...base,
      targetAgents: [123 as unknown as string],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('targetAgents must be a string array'))).toBe(true);
  });
});

describe('validateManifest companions', () => {
  const base = { name: 'my-skill', version: '1.0.0', description: 'd' };

  it('accepts manifest without companions', () => {
    expect(validateManifest({ ...base }).valid).toBe(true);
  });

  it('accepts a valid single companion', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'agents/runner.md',
          agentTargets: { 'claude-code': '.claude/agents/runner.md' },
        },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('rejects companion with empty source', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: '',
          agentTargets: { 'claude-code': '.claude/agents/x.md' },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('source'))).toBe(true);
  });

  it('rejects companion source containing ..', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: '../etc/passwd',
          agentTargets: { 'claude-code': '.claude/agents/x.md' },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('..'))).toBe(true);
  });

  it('rejects companion source nested .. segment', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'agents/../../etc',
          agentTargets: { 'claude-code': '.claude/agents/x.md' },
        },
      ],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects companion with empty agentTargets object', () => {
    const r = validateManifest({
      ...base,
      companions: [{ source: 'a.md', agentTargets: {} }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('at least one agent target'))).toBe(true);
  });

  it('rejects companion with unknown agent in agentTargets', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'a.md',
          agentTargets: { 'unknown-tool': '.x/y.md' },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('unknown agent'))).toBe(true);
  });

  it('rejects target path containing ..', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'a.md',
          agentTargets: { 'claude-code': '../../outside/file.md' },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('..'))).toBe(true);
  });

  it('rejects absolute target path', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'a.md',
          agentTargets: { 'claude-code': '/etc/passwd' },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('absolute'))).toBe(true);
  });

  it('rejects companion with agent outside targetAgents subset', () => {
    const r = validateManifest({
      ...base,
      targetAgents: ['claude-code'],
      companions: [
        {
          source: 'a.md',
          agentTargets: {
            'claude-code': '.claude/agents/a.md',
            'codex': '.codex/agents/a.md',
          },
        },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("'codex'"))).toBe(true);
    expect(r.errors.some((e) => e.includes('targetAgents'))).toBe(true);
  });

  it('accepts companion when targetAgents undefined (full set)', () => {
    const r = validateManifest({
      ...base,
      companions: [
        {
          source: 'a.md',
          agentTargets: { 'claude-code': '.claude/agents/a.md' },
        },
      ],
    });
    expect(r.valid).toBe(true);
  });

  it('rejects companions not an array', () => {
    const r = validateManifest({
      ...base,
      companions: 'not-array' as unknown as never,
    });
    expect(r.valid).toBe(false);
  });
});

describe('resolveCompanionSource', () => {
  it('resolves a source inside skill dir', () => {
    const r = resolveCompanionSource('/tmp/skill', 'agents/runner.md');
    expect(r.ok).toBe(true);
    expect(r.resolvedPath).toBe('/tmp/skill/agents/runner.md');
  });

  it('rejects source with .. that escapes skill dir', () => {
    const r = resolveCompanionSource('/tmp/skill', '../outside.md');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/\.\./);
  });

  it('rejects absolute source', () => {
    const r = resolveCompanionSource('/tmp/skill', '/etc/passwd');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/absolute/);
  });
});

describe('resolveCompanionTarget', () => {
  it('resolves a target inside project dir', () => {
    const r = resolveCompanionTarget('/tmp/proj', '.claude/agents/x.md');
    expect(r.ok).toBe(true);
    expect(r.resolvedPath).toBe('/tmp/proj/.claude/agents/x.md');
  });

  it('rejects target with .. that escapes project dir', () => {
    const r = resolveCompanionTarget('/tmp/proj', '../outside/x.md');
    expect(r.ok).toBe(false);
  });

  it('rejects absolute target', () => {
    const r = resolveCompanionTarget('/tmp/proj', '/etc/x.md');
    expect(r.ok).toBe(false);
  });
});

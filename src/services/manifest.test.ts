import { describe, it, expect } from 'vitest';
import { validatePackageName, validateManifest } from './manifest.js';

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

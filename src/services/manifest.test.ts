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
});

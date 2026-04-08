import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsonOutput, jsonError } from './json-output.js';

describe('json-output', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('jsonOutput', () => {
    it('writes JSON to stdout with trailing newline', () => {
      jsonOutput({ skills: [] });
      expect(stdoutSpy).toHaveBeenCalledWith('{"skills":[]}\n');
    });

    it('serializes nested objects', () => {
      jsonOutput({ results: [{ name: 'a', version: '1.0' }], total: 1 });
      const written = (stdoutSpy.mock.calls[0] as string[])[0];
      expect(JSON.parse(written)).toEqual({ results: [{ name: 'a', version: '1.0' }], total: 1 });
    });
  });

  describe('jsonError', () => {
    it('writes error JSON to stdout', () => {
      jsonError('not found', 'NOT_FOUND');
      const written = (stdoutSpy.mock.calls[0] as string[])[0];
      expect(JSON.parse(written)).toEqual({ error: 'not found', code: 'NOT_FOUND' });
    });
  });
});

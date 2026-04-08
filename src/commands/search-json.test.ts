import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockSearch = vi.hoisted(() => vi.fn());

vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    search: mockSearch,
  })),
}));

import { executeSearch } from './search.js';

describe('search --json', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSearch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs search results as JSON', async () => {
    mockSearch.mockResolvedValue({
      objects: [
        { package: { name: 'skill-a', version: '1.0.0', description: 'A skill' } },
        { package: { name: 'skill-b', version: '2.0.0', description: 'B skill' } },
      ],
      total: 2,
    });

    await executeSearch('test', { json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]).toEqual({ name: 'skill-a', version: '1.0.0', description: 'A skill' });
    expect(parsed.total).toBe(2);
  });

  it('outputs empty results as JSON', async () => {
    mockSearch.mockResolvedValue({ objects: [], total: 0 });

    await executeSearch('nothing', { json: true });

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.results).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('outputs error as JSON on failure', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(executeSearch('fail', { json: true })).rejects.toThrow('process.exit');

    const written = (stdoutSpy.mock.calls[0] as string[])[0] as string;
    const parsed = JSON.parse(written);

    expect(parsed.error).toBe('Network error');
    expect(parsed.code).toBe('SEARCH_ERROR');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

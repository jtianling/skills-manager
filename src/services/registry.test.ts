import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistryService } from './registry.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RegistryService', () => {
  let service: RegistryService;

  beforeEach(() => {
    service = new RegistryService('https://test-registry.dev');
    mockFetch.mockReset();
  });

  describe('getPackument', () => {
    it('fetches packument for existing package', async () => {
      const packument = {
        name: 'code-review',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: 'code-review', version: '1.0.0' } },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(packument),
      });

      const result = await service.getPackument('code-review');
      expect(result).toEqual(packument);
      expect(mockFetch).toHaveBeenCalledWith('https://test-registry.dev/api/r/code-review', {
        headers: { 'Accept': 'application/json' },
      });
    });

    it('throws for non-existent package', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(service.getPackument('nonexistent')).rejects.toThrow(
        'Package "nonexistent" not found in registry'
      );
    });

    it('handles scoped package names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ name: '@scope/pkg' }),
      });

      await service.getPackument('@scope/pkg');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('@'),
        expect.any(Object)
      );
    });
  });

  describe('search', () => {
    it('returns search results', async () => {
      const searchResult = {
        objects: [{ package: { name: 'test', version: '1.0.0', description: 'test' } }],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResult),
      });

      const result = await service.search('test', { size: 5 });
      expect(result.objects).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('text=test'),
        expect.any(Object)
      );
    });

    it('returns empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ objects: [], total: 0 }),
      });

      const result = await service.search('nonexistent');
      expect(result.objects).toHaveLength(0);
    });
  });

  describe('publish', () => {
    it('publishes successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await service.publish('test-skill', {
        version: '1.0.0',
        description: 'test',
        manifest: { name: 'test-skill', version: '1.0.0', description: 'test' },
        tarball: 'base64data',
      }, 'spm_xxx');

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-registry.dev/api/r/test-skill',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer spm_xxx',
          }),
        })
      );
    });

    it('throws on version conflict (409)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      await expect(
        service.publish('test', {
          version: '1.0.0',
          description: 'test',
          manifest: { name: 'test', version: '1.0.0', description: 'test' },
          tarball: 'data',
        }, 'token')
      ).rejects.toThrow('Version 1.0.0 already exists');
    });

    it('throws on auth failure (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(
        service.publish('test', {
          version: '1.0.0',
          description: 'test',
          manifest: { name: 'test', version: '1.0.0', description: 'test' },
          tarball: 'data',
        }, 'bad-token')
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('whoami', () => {
    it('returns username', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ username: 'testuser' }),
      });

      const result = await service.whoami('spm_valid');
      expect(result.username).toBe('testuser');
    });

    it('throws on expired token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(service.whoami('spm_expired')).rejects.toThrow('Token expired');
    });
  });

  describe('npmLogin', () => {
    it('returns token on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, token: 'spm_new' }),
      });

      const result = await service.npmLogin('user', 'pass');
      expect(result.token).toBe('spm_new');
    });

    it('throws on invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(service.npmLogin('user', 'wrong')).rejects.toThrow('Invalid username or password');
    });
  });
});

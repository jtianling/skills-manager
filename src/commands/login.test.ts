import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const mockWhoami = vi.hoisted(() => vi.fn());
const mockNpmLogin = vi.hoisted(() => vi.fn());

vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    whoami: mockWhoami,
    npmLogin: mockNpmLogin,
  })),
}));

vi.mock('../services/auth.js', async (importOriginal) => {
  let authFile: string;
  const original = await importOriginal<typeof import('../services/auth.js')>();
  return {
    ...original,
    readAuth: vi.fn().mockReturnValue(null),
    writeAuth: vi.fn(),
  };
});

import { executeLogin } from './login.js';
import { writeAuth } from '../services/auth.js';

describe('login command', () => {
  beforeEach(() => {
    mockWhoami.mockReset();
    mockNpmLogin.mockReset();
    vi.mocked(writeAuth).mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('--token', () => {
    it('logs in with valid token', async () => {
      mockWhoami.mockResolvedValue({ username: 'testuser' });

      await executeLogin({ token: 'spm_valid' });

      expect(mockWhoami).toHaveBeenCalledWith('spm_valid');
      expect(writeAuth).toHaveBeenCalledWith({ token: 'spm_valid', username: 'testuser' });
    });

    it('exits with error on invalid token', async () => {
      mockWhoami.mockRejectedValue(new Error('Token expired or invalid'));
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeLogin({ token: 'spm_bad' })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockWhoami = vi.hoisted(() => vi.fn());
const mockNpmLogin = vi.hoisted(() => vi.fn());
const mockPrompt = vi.hoisted(() => vi.fn());

vi.mock('../services/registry.js', () => ({
  RegistryService: vi.fn().mockImplementation(() => ({
    whoami: mockWhoami,
    npmLogin: mockNpmLogin,
  })),
}));

vi.mock('../services/auth.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/auth.js')>();
  return {
    ...original,
    readAuth: vi.fn().mockReturnValue(null),
    writeAuth: vi.fn(),
  };
});

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

import { executeLogin } from './login.js';
import { writeAuth } from '../services/auth.js';

describe('login command', () => {
  const originalEnv = process.env.SKILLSMGR_TOKEN;

  beforeEach(() => {
    mockWhoami.mockReset();
    mockNpmLogin.mockReset();
    mockPrompt.mockReset();
    vi.mocked(writeAuth).mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.SKILLSMGR_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.SKILLSMGR_TOKEN = originalEnv;
    } else {
      delete process.env.SKILLSMGR_TOKEN;
    }
  });

  describe('--token with SKILLSMGR_TOKEN env var', () => {
    it('reads token from env var', async () => {
      process.env.SKILLSMGR_TOKEN = 'env_abc123';
      mockWhoami.mockResolvedValue({ username: 'envuser' });

      await executeLogin({ token: true });

      expect(mockWhoami).toHaveBeenCalledWith('env_abc123');
      expect(writeAuth).toHaveBeenCalledWith({ token: 'env_abc123', username: 'envuser' });
    });

    it('exits with error on invalid env token', async () => {
      process.env.SKILLSMGR_TOKEN = 'bad_token';
      mockWhoami.mockRejectedValue(new Error('Token expired or invalid'));
      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit');
      }) as never);

      await expect(executeLogin({ token: true })).rejects.toThrow('process.exit');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('--token interactive masked input', () => {
    it('prompts for token with mask when no env and TTY', async () => {
      mockPrompt.mockResolvedValue({ token: 'prompted_token' });
      mockWhoami.mockResolvedValue({ username: 'promptuser' });

      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });

      try {
        await executeLogin({ token: true });
      } finally {
        Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
      }

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'password',
          name: 'token',
          message: 'Token:',
          mask: '*',
        }),
      ]);
      expect(mockWhoami).toHaveBeenCalledWith('prompted_token');
      expect(writeAuth).toHaveBeenCalledWith({ token: 'prompted_token', username: 'promptuser' });
    });
  });

  describe('--token stdin pipe', () => {
    it('reads token from stdin when not TTY', async () => {
      mockWhoami.mockResolvedValue({ username: 'pipeuser' });

      const { Readable } = await import('stream');
      const mockStdin = new Readable({
        read() {
          this.push('piped_token\n');
          this.push(null);
        },
      });

      const stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
      Object.defineProperty(process, 'stdin', {
        value: Object.assign(mockStdin, { isTTY: false }),
        configurable: true,
      });

      try {
        await executeLogin({ token: true });
      } finally {
        if (stdinDescriptor) {
          Object.defineProperty(process, 'stdin', stdinDescriptor);
        }
      }

      expect(mockWhoami).toHaveBeenCalledWith('piped_token');
      expect(writeAuth).toHaveBeenCalledWith({ token: 'piped_token', username: 'pipeuser' });
    });
  });

  describe('without --token flag', () => {
    it('does not resolve token when flag is not used', async () => {
      mockPrompt.mockResolvedValue({ useBrowser: false, username: 'user1', password: 'pass1' });
      mockNpmLogin.mockResolvedValue({ token: 't1' });

      await executeLogin({});

      expect(mockWhoami).not.toHaveBeenCalled();
    });
  });
});

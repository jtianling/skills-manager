import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, realpathSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/prompts.js', () => ({
  promptConfirm: vi.fn().mockResolvedValue(true),
}));

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { DeploymentsRegistryService } from '../services/deployments-registry.js';
import { promptConfirm } from '../utils/prompts.js';
import { deploymentsCommand } from './deployments.js';

describe('deployments command', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-deployments-cmd-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });

    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function seedEntry(path: string, partial: Partial<{
    mode: 'link' | 'copy';
    followGroups: string[];
    pinnedSkills: string[];
    lastDeployedAt: string;
  }> = {}): void {
    const service = new DeploymentsRegistryService();
    const registry = service.readRegistry();
    registry.deployments[path] = {
      mode: partial.mode ?? 'link',
      followGroups: partial.followGroups ?? [],
      pinnedSkills: partial.pinnedSkills ?? [],
      lastDeployedAt: partial.lastDeployedAt ?? '2026-04-15T00:00:00.000Z',
    };
    service.writeRegistry(registry);
  }

  it('list outputs friendly message when registry empty', async () => {
    await deploymentsCommand.parseAsync(['list'], { from: 'user' });
    expect(console.log).toHaveBeenCalledWith(
      'No deployments registered.  Run `skillsmgr deploy` in a project to register one.',
    );
  });

  it('list shows entries with missing flag', async () => {
    const existing = join(tmpdir(), `skillsmgr-cmd-existing-${Date.now()}`);
    mkdirSync(existing);
    seedEntry(existing, { followGroups: ['dev'] });
    seedEntry('/gone-path');

    await deploymentsCommand.parseAsync(['list'], { from: 'user' });

    const calls = vi.mocked(console.log).mock.calls.map((args) => String(args[0]));
    expect(calls.some((line) => line.includes('/gone-path (missing)'))).toBe(true);
    expect(calls.some((line) => line.includes(existing) && !line.includes('(missing)'))).toBe(true);
    expect(calls.some((line) => line === '  follow: dev' || line === '  follow: -')).toBe(true);

    rmSync(existing, { recursive: true, force: true });
  });

  it('list --json outputs structured', async () => {
    const existing = join(tmpdir(), `skillsmgr-cmd-json-${Date.now()}`);
    mkdirSync(existing);
    seedEntry(existing);

    let captured = '';
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
        return true;
      });

    await deploymentsCommand.parseAsync(['list', '--json'], { from: 'user' });

    writeSpy.mockRestore();
    const parsed = JSON.parse(captured.trim());
    expect(parsed.deployments).toHaveLength(1);

    rmSync(existing, { recursive: true, force: true });
  });

  it('prune with no stale entries returns friendly message', async () => {
    const existing = join(tmpdir(), `skillsmgr-cmd-prune-ok-${Date.now()}`);
    mkdirSync(existing);
    seedEntry(existing);

    await deploymentsCommand.parseAsync(['prune'], { from: 'user' });
    expect(console.log).toHaveBeenCalledWith('No stale entries found.');

    rmSync(existing, { recursive: true, force: true });
  });

  it('prune with confirmation removes stale', async () => {
    seedEntry('/gone-1');
    seedEntry('/gone-2');
    vi.mocked(promptConfirm).mockResolvedValue(true);

    await deploymentsCommand.parseAsync(['prune'], { from: 'user' });

    expect(promptConfirm).toHaveBeenCalled();
    const result = new DeploymentsRegistryService().readRegistry();
    expect(Object.keys(result.deployments)).toEqual([]);
  });

  it('prune cancelled keeps entries', async () => {
    seedEntry('/gone-1');
    vi.mocked(promptConfirm).mockResolvedValue(false);

    await deploymentsCommand.parseAsync(['prune'], { from: 'user' });

    const result = new DeploymentsRegistryService().readRegistry();
    expect(result.deployments['/gone-1']).toBeDefined();
  });

  it('prune -y skips confirmation', async () => {
    seedEntry('/gone-1');

    await deploymentsCommand.parseAsync(['prune', '-y'], { from: 'user' });

    expect(promptConfirm).not.toHaveBeenCalled();
    const result = new DeploymentsRegistryService().readRegistry();
    expect(Object.keys(result.deployments)).toEqual([]);
  });

  it('remove deletes specific entry', async () => {
    const existing = join(tmpdir(), `skillsmgr-cmd-rm-${Date.now()}`);
    mkdirSync(existing);
    const realPath = realpathSync(existing);
    seedEntry(realPath);

    await deploymentsCommand.parseAsync(['remove', existing], { from: 'user' });

    const result = new DeploymentsRegistryService().readRegistry();
    expect(result.deployments[realPath]).toBeUndefined();

    rmSync(existing, { recursive: true, force: true });
  });

  it('remove unknown path errors out', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);

    await expect(
      deploymentsCommand.parseAsync(['remove', '/never-existed'], { from: 'user' }),
    ).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

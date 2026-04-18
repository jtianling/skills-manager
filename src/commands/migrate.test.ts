import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./setup.js', () => ({
  ensureSetup: vi.fn(),
}));

import * as constants from '../constants.js';
import { DeploymentsRegistryService } from '../services/deployments-registry.js';
import { executeMigrate } from './migrate.js';

describe('migrate command', () => {
  let testManagerDir: string;
  let projectA: string;
  let projectB: string;
  let originalCwd: string;
  let cwdDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-migrate-mgr-${id}`);
    projectA = join(tmpdir(), `skillsmgr-migrate-a-${id}`);
    projectB = join(tmpdir(), `skillsmgr-migrate-b-${id}`);
    cwdDir = join(tmpdir(), `skillsmgr-migrate-cwd-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(projectA, { recursive: true });
    mkdirSync(projectB, { recursive: true });
    mkdirSync(cwdDir, { recursive: true });
    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
    originalCwd = process.cwd();
    process.chdir(cwdDir);

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
    rmSync(cwdDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function registerEntry(path: string): void {
    const service = new DeploymentsRegistryService();
    service.recordDeploy(path, {
      mode: 'link',
      followGroups: [],
      pinnedSkills: [],
      lastDeployedAt: '2026-04-15T00:00:00.000Z',
    });
  }

  function writeOldManifest(project: string, content: string): void {
    mkdirSync(join(project, '.skills-manager'), { recursive: true });
    writeFileSync(join(project, '.skills-manager', 'deployment.json'), content);
  }

  it('moves .skills-manager/deployment.json to skillsmgr-deploy.json', async () => {
    registerEntry(projectA);
    const body = JSON.stringify({
      mode: 'link',
      followGroups: ['dev'],
      pinnedSkills: [],
      deployedAt: '2026-04-15T00:00:00.000Z',
    });
    writeOldManifest(projectA, body);

    await executeMigrate();

    expect(existsSync(join(projectA, 'skillsmgr-deploy.json'))).toBe(true);
    expect(existsSync(join(projectA, '.skills-manager', 'deployment.json'))).toBe(false);
    expect(existsSync(join(projectA, '.skills-manager'))).toBe(false);
    expect(readFileSync(join(projectA, 'skillsmgr-deploy.json'), 'utf-8')).toBe(body);
  });

  it('skips when new file already exists, leaves old untouched', async () => {
    registerEntry(projectA);
    writeOldManifest(projectA, '{"mode":"link"}');
    writeFileSync(join(projectA, 'skillsmgr-deploy.json'), '{"mode":"copy"}');

    await executeMigrate();

    expect(readFileSync(join(projectA, 'skillsmgr-deploy.json'), 'utf-8')).toBe(
      '{"mode":"copy"}',
    );
    expect(existsSync(join(projectA, '.skills-manager', 'deployment.json'))).toBe(true);
  });

  it('skips projects without old manifest silently', async () => {
    registerEntry(projectA);
    await executeMigrate();
    expect(existsSync(join(projectA, 'skillsmgr-deploy.json'))).toBe(false);
  });

  it('preserves .skills-manager/ when it has other files', async () => {
    registerEntry(projectA);
    writeOldManifest(projectA, '{}');
    writeFileSync(join(projectA, '.skills-manager', 'other.txt'), 'keep me');

    await executeMigrate();

    expect(existsSync(join(projectA, 'skillsmgr-deploy.json'))).toBe(true);
    expect(existsSync(join(projectA, '.skills-manager'))).toBe(true);
    expect(existsSync(join(projectA, '.skills-manager', 'other.txt'))).toBe(true);
  });

  it('migrates cwd even if not in registry', async () => {
    writeOldManifest(cwdDir, '{}');
    await executeMigrate();
    expect(existsSync(join(cwdDir, 'skillsmgr-deploy.json'))).toBe(true);
  });

  it('handles missing project path in registry without failing', async () => {
    const removed = join(tmpdir(), `skillsmgr-migrate-gone-${Date.now()}`);
    registerEntry(removed);
    registerEntry(projectB);
    writeOldManifest(projectB, '{}');

    await executeMigrate();

    expect(existsSync(join(projectB, 'skillsmgr-deploy.json'))).toBe(true);
  });
});

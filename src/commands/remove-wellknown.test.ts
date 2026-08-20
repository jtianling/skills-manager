import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../utils/interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import * as constants from '../constants.js';
import { executeRemove } from './remove.js';
import { SourcesService } from '../services/sources.js';

describe('remove by well-known site URL', () => {
  let testManagerDir: string;
  let testProjectDir: string;
  let originalCwd: typeof process.cwd;

  function createSkill(source: string, skillName: string): string {
    const skillDir = join(testManagerDir, source, skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${skillName}\ndescription: test\n---\n`,
    );
    return skillDir;
  }

  function deploy(skillName: string, sourcePath: string): string {
    const deployedPath = join(testProjectDir, '.agents', 'skills', skillName);
    symlinkSync(sourcePath, deployedPath);
    return deployedPath;
  }

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `smgr-remove-wk-mgr-${id}`);
    testProjectDir = join(tmpdir(), `smgr-remove-wk-proj-${id}`);
    mkdirSync(testManagerDir, { recursive: true });
    mkdirSync(join(testProjectDir, '.agents', 'skills'), { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', {
      value: testManagerDir,
      writable: true,
    });
    originalCwd = process.cwd;
    process.cwd = () => testProjectDir;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(testManagerDir, { recursive: true, force: true });
    rmSync(testProjectDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function seedInstalledSite(): { alpha: string; other: string } {
    const alphaSource = createSkill('well-known/docs.stripe.com', 'alpha');
    const otherSource = createSkill('community/owner/repo', 'other');
    new SourcesService().addSource('well-known/docs.stripe.com', {
      url: 'https://docs.stripe.com',
      type: 'well-known',
      repoName: 'docs.stripe.com',
      installMethod: 'well-known',
      skillDigests: { alpha: `sha256:${'a'.repeat(64)}` },
    });
    new SourcesService().addSource('community/owner/repo', {
      url: 'https://github.com/owner/repo',
      type: 'community',
      repoName: 'repo',
      installMethod: 'git',
    });
    return {
      alpha: deploy('alpha', alphaSource),
      other: deploy('other', otherSource),
    };
  }

  it('removes the deployed skills of the matching site and nothing else', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const deployed = seedInstalledSite();

    await executeRemove('https://docs.stripe.com', { all: true });

    expect(existsSync(deployed.alpha)).toBe(false);
    expect(existsSync(deployed.other)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches the site URL with a trailing slash', async () => {
    const deployed = seedInstalledSite();

    await executeRemove('https://docs.stripe.com/', { all: true });

    expect(existsSync(deployed.alpha)).toBe(false);
    expect(existsSync(deployed.other)).toBe(true);
  });

  it('leaves deployments intact for a site that is not installed', async () => {
    const deployed = seedInstalledSite();
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);

    await executeRemove('https://example.com', { all: true });

    expect(existsSync(deployed.alpha)).toBe(true);
    expect(existsSync(deployed.other)).toBe(true);
    expect(exitSpy).toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('../services/registry.js', () => {
  class RegistryService {
    async getPackument(name: string) {
      return {
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            dist: { tarball: `https://registry.test/${name}/-/package-1.0.0.tgz` },
          },
        },
      };
    }

    async downloadTarball(_url: string, destDir: string) {
      mkdirSync(destDir, { recursive: true });
      writeFileSync(
        join(destDir, 'SKILL.md'),
        '---\nname: registry-skill\ndescription: Registry skill\n---\n',
      );
    }
  }

  return { RegistryService };
});

import * as constants from '../constants.js';
import { executeInstall } from './install.js';

describe('install registry bundle tracking', () => {
  let testManagerDir: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    testManagerDir = join(tmpdir(), `skillsmgr-install-registry-${id}`);
    mkdirSync(testManagerDir, { recursive: true });

    Object.defineProperty(constants, 'SKILLS_MANAGER_DIR', { value: testManagerDir, writable: true });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(testManagerDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function readSources() {
    return JSON.parse(readFileSync(join(testManagerDir, 'sources.json'), 'utf-8'));
  }

  it('does not create bundle entries for registry installs', async () => {
    await executeInstall('some-registry-package@1.0.0', {});

    const sources = readSources();
    expect(sources.sources['registry/some-registry-package']).toMatchObject({
      type: 'registry',
      repoName: 'some-registry-package',
      installMethod: 'registry',
      version: '1.0.0',
    });
    expect(sources.bundles).toEqual({});
  });
});

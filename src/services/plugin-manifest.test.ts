import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPluginSkillPaths } from './plugin-manifest.js';

describe('getPluginSkillPaths', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = join(tmpdir(), `skillsmgr-manifest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(basePath, { recursive: true });
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  describe('marketplace.json', () => {
    it('discovers skills from multiple plugins', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, '.github', 'plugins', 'plugin-a', 'skills'), { recursive: true });
      mkdirSync(join(basePath, '.github', 'plugins', 'plugin-b', 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          metadata: { pluginRoot: './.github/plugins' },
          plugins: [
            { name: 'plugin-a', source: './plugin-a', skills: 'skills/' },
            { name: 'plugin-b', source: './plugin-b', skills: 'skills/' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, '.github', 'plugins', 'plugin-a', 'skills'));
      expect(paths).toContain(join(basePath, '.github', 'plugins', 'plugin-b', 'skills'));
    });

    it('handles plugins without explicit skills field', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'plugins', 'my-plugin', 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          metadata: { pluginRoot: './plugins' },
          plugins: [
            { name: 'my-plugin', source: './my-plugin' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'plugins', 'my-plugin', 'skills'));
    });

    it('handles no pluginRoot', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'my-plugin', 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          plugins: [
            { name: 'my-plugin', source: './my-plugin', skills: 'skills/' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'my-plugin', 'skills'));
    });

    it('skips remote source objects', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          plugins: [
            { name: 'remote', source: { source: 'some-repo', repo: 'https://github.com/foo/bar' } },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('skips path traversal in pluginRoot', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          metadata: { pluginRoot: './../../etc' },
          plugins: [
            { name: 'evil', source: './evil' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('skips path traversal in plugin source', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          plugins: [
            { name: 'evil', source: './../../etc' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('skips source not starting with ./', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          plugins: [
            { name: 'bad', source: '/absolute/path' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });
  });

  describe('plugin.json', () => {
    it('discovers skills from single plugin', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: 'my-plugin', skills: 'skills/' }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'skills'));
    });

    it('handles skills as array of paths', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: 'my-plugin', skills: ['./skills/a', './skills/b'] }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'skills', 'a'));
      expect(paths).toContain(join(basePath, 'skills', 'b'));
    });
  });

  describe('plugin.json marketplace format', () => {
    it('discovers skills when plugin.json has plugins array', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, '.github', 'plugins', 'plugin-a', 'skills'), { recursive: true });
      mkdirSync(join(basePath, '.github', 'plugins', 'plugin-b', 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          metadata: { pluginRoot: './.github/plugins' },
          plugins: [
            { name: 'plugin-a', source: './plugin-a', skills: 'skills/' },
            { name: 'plugin-b', source: './plugin-b', skills: 'skills/' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, '.github', 'plugins', 'plugin-a', 'skills'));
      expect(paths).toContain(join(basePath, '.github', 'plugins', 'plugin-b', 'skills'));
    });

    it('merges both formats when plugin.json has plugins array and top-level skills', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'skills'), { recursive: true });
      mkdirSync(join(basePath, 'plugins', 'extra', 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          skills: './skills/',
          metadata: { pluginRoot: './plugins' },
          plugins: [
            { name: 'extra', source: './extra', skills: 'skills/' },
          ],
        }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'plugins', 'extra', 'skills'));
      expect(paths).toContain(join(basePath, 'skills'));
    });

    it('still works as simple format when no plugins array', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'my-skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: 'test', skills: './my-skills' }),
      );

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toContain(join(basePath, 'my-skills'));
    });
  });

  describe('edge cases', () => {
    it('returns empty when no manifest files exist', () => {
      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('returns empty for invalid JSON in marketplace.json', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      writeFileSync(join(basePath, '.claude-plugin', 'marketplace.json'), '{invalid json');

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('returns empty for invalid JSON in plugin.json', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      writeFileSync(join(basePath, '.claude-plugin', 'plugin.json'), 'not json');

      const paths = getPluginSkillPaths(basePath);
      expect(paths).toEqual([]);
    });

    it('deduplicates paths from both manifests', () => {
      mkdirSync(join(basePath, '.claude-plugin'), { recursive: true });
      mkdirSync(join(basePath, 'skills'), { recursive: true });

      writeFileSync(
        join(basePath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          plugins: [{ name: 'root', source: './', skills: 'skills/' }],
        }),
      );
      writeFileSync(
        join(basePath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: 'root', skills: 'skills/' }),
      );

      const paths = getPluginSkillPaths(basePath);
      const skillsPath = join(basePath, 'skills');
      expect(paths.filter((p) => p === skillsPath)).toHaveLength(1);
    });
  });
});

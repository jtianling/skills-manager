import { join, resolve, normalize, sep } from 'path';
import { fileExists, readFileContent } from '../utils/fs.js';

interface PluginEntry {
  source?: string | { source: string; repo?: string };
  skills?: string | string[];
  name?: string;
}

interface MarketplaceManifest {
  metadata?: { pluginRoot?: string };
  plugins?: PluginEntry[];
}

interface PluginManifest {
  skills?: string | string[];
  name?: string;
}

function isValidRelativePath(path: string): boolean {
  return path.startsWith('./');
}

function isContainedIn(targetPath: string, basePath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  return normalizedTarget.startsWith(normalizedBase + sep) || normalizedTarget === normalizedBase;
}

function hasPathTraversal(path: string): boolean {
  return path.split('/').includes('..');
}

function collectPluginSkillDirs(pluginBase: string, basePath: string, skills?: string | string[]): string[] {
  if (!isContainedIn(pluginBase, basePath)) {
    return [];
  }

  const dirs: string[] = [];

  if (typeof skills === 'string') {
    if (isValidRelativePath(`./${skills}`) || isValidRelativePath(skills)) {
      const skillsDir = join(pluginBase, skills);
      if (isContainedIn(skillsDir, basePath)) {
        dirs.push(skillsDir);
      }
    }
  } else if (Array.isArray(skills)) {
    for (const skillPath of skills) {
      if (!isValidRelativePath(skillPath)) continue;
      const skillDir = join(pluginBase, skillPath);
      if (isContainedIn(skillDir, basePath)) {
        dirs.push(skillDir);
      }
    }
  }

  const conventionalDir = join(pluginBase, 'skills');
  if (isContainedIn(conventionalDir, basePath) && !dirs.includes(conventionalDir)) {
    dirs.push(conventionalDir);
  }

  return dirs;
}

function resolvePluginBase(basePath: string, pluginRoot: string | undefined, source: string | undefined): string {
  if (!source) {
    return join(basePath, pluginRoot ?? '');
  }
  if (!pluginRoot) {
    return join(basePath, source);
  }

  const normalizedRoot = pluginRoot.replace(/^\.\//, '');
  const normalizedSource = source.replace(/^\.\//, '');

  if (normalizedSource.startsWith(normalizedRoot + '/') || normalizedSource === normalizedRoot) {
    return join(basePath, source);
  }

  return join(basePath, pluginRoot, source);
}

function parseMarketplaceManifest(basePath: string, manifest: MarketplaceManifest): string[] {
  const pluginRoot = manifest.metadata?.pluginRoot;

  if (pluginRoot !== undefined && !isValidRelativePath(pluginRoot)) {
    return [];
  }
  if (pluginRoot !== undefined && hasPathTraversal(pluginRoot)) {
    return [];
  }

  const dirs: string[] = [];

  for (const plugin of manifest.plugins ?? []) {
    if (typeof plugin.source !== 'string' && plugin.source !== undefined) {
      continue;
    }

    const source = plugin.source;
    if (source !== undefined && !isValidRelativePath(source)) continue;
    if (source !== undefined && hasPathTraversal(source)) continue;

    const pluginBase = resolvePluginBase(basePath, pluginRoot, source);
    dirs.push(...collectPluginSkillDirs(pluginBase, basePath, plugin.skills));
  }

  return dirs;
}

function parsePluginManifest(basePath: string, manifest: PluginManifest): string[] {
  return collectPluginSkillDirs(basePath, basePath, manifest.skills);
}

function tryParseJson<T>(path: string): T | null {
  if (!fileExists(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileContent(path)) as T;
  } catch {
    return null;
  }
}

export function getPluginSkillPaths(basePath: string): string[] {
  const dirs: string[] = [];

  const marketplace = tryParseJson<MarketplaceManifest>(
    join(basePath, '.claude-plugin', 'marketplace.json'),
  );
  if (marketplace) {
    dirs.push(...parseMarketplaceManifest(basePath, marketplace));
  }

  const pluginRaw = tryParseJson<PluginManifest & MarketplaceManifest>(
    join(basePath, '.claude-plugin', 'plugin.json'),
  );
  if (pluginRaw) {
    if (Array.isArray(pluginRaw.plugins)) {
      dirs.push(...parseMarketplaceManifest(basePath, pluginRaw));
    }
    dirs.push(...parsePluginManifest(basePath, pluginRaw));
  }

  return [...new Set(dirs)];
}

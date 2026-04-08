import { join } from 'path';
import { REGISTRY_URL, SKILLS_MANAGER_DIR, OFFICIAL_OWNERS } from '../constants.js';
import { RegistryService } from '../services/registry.js';
import { SourcesService } from '../services/sources.js';
import { readManifest } from '../services/manifest.js';
import { resolveDependencies, parseDependencyIdentifier, type ParsedDependency } from '../services/dependency.js';
import type { InstallOptions, SkillManifest } from '../types.js';
import { fileExists, findScriptFiles, removeDir, warnScriptFiles } from '../utils/fs.js';
import type { RegistryDetectedSource } from '../utils/source-detection.js';
import { promptConfirm } from '../utils/prompts.js';
import {
  createInstallResult,
  scanSkillDirectories,
  selectSkills,
} from './install-utils.js';
import type { InstallResult } from './install-utils.js';
import { installViaGitClone } from './install-git.js';

const registryService = new RegistryService();
const sourcesService = new SourcesService();

function getRegistryInstallDir(packageName: string): string {
  return join(SKILLS_MANAGER_DIR, 'registry', packageName);
}

export function isOfficialShortcut(name: string): boolean {
  return name in OFFICIAL_OWNERS;
}

export async function installFromRegistry(
  detected: RegistryDetectedSource,
  options: InstallOptions,
): Promise<InstallResult> {
  const { packageName, requestedVersion } = detected;

  // Official shortcuts take priority over registry
  if (!requestedVersion && isOfficialShortcut(packageName)) {
    throw new Error(
      `"${packageName}" is an official provider shortcut. Use "skillsmgr install ${OFFICIAL_OWNERS[packageName]}/skills" instead.`
    );
  }

  console.log(`Fetching package "${packageName}" from registry...`);

  const packument = await registryService.getPackument(packageName);

  const version = requestedVersion || packument['dist-tags']?.latest;
  if (!version) {
    throw new Error(`No version found for "${packageName}"`);
  }

  const versionData = packument.versions[version];
  if (!versionData) {
    throw new Error(`Version ${version} not found for "${packageName}". Available: ${Object.keys(packument.versions).join(', ')}`);
  }

  const tarballUrl = versionData.dist.tarball;
  if (!tarballUrl) {
    throw new Error(`No tarball URL found for "${packageName}@${version}"`);
  }

  const installDir = getRegistryInstallDir(packageName);

  // Check if already installed
  if (fileExists(installDir)) {
    const existingSource = sourcesService.getSource(`registry/${packageName}`);
    const existingVersion = existingSource?.version;

    if (existingVersion === version && !options.force) {
      console.log(`${packageName}@${version} is already installed.`);
      return createInstallResult([], []);
    }

    if (!options.force) {
      const msg = existingVersion
        ? `${packageName}@${existingVersion} is installed. Update to ${version}?`
        : `${packageName} is already installed. Overwrite?`;
      const confirmed = await promptConfirm(msg);
      if (!confirmed) {
        console.log('Cancelled.');
        return createInstallResult([], []);
      }
    }

    removeDir(installDir);
  }

  console.log(`Downloading ${packageName}@${version}...`);
  await registryService.downloadTarball(tarballUrl, installDir);

  // Discover skills in the extracted package
  const skills = scanSkillDirectories(installDir);
  if (skills.length === 0) {
    console.log(`Warning: No SKILL.md found in ${packageName}@${version}`);
  }

  const { skills: selectedSkills } = await selectSkills(skills, options);
  const allScriptFiles: string[] = [];

  for (const skill of selectedSkills) {
    allScriptFiles.push(...findScriptFiles(skill.path));
  }

  warnScriptFiles(allScriptFiles);

  // Record source
  const sourceKey = `registry/${packageName}`;
  sourcesService.addSource(sourceKey, {
    url: `${REGISTRY_URL}/${packageName}`,
    type: 'registry',
    repoName: packageName,
    installMethod: 'registry',
    version,
    registryUrl: REGISTRY_URL,
  });

  const installedPaths = selectedSkills.map((s) => s.path);
  const sourceKeys = selectedSkills.map(() => sourceKey);

  console.log(`✓ Installed ${packageName}@${version}`);
  if (skills.length > 0) {
    for (const skill of selectedSkills) {
      console.log(`  - ${skill.name}: ${skill.description || '(no description)'}`);
    }
  }

  // Resolve dependencies
  const manifest = readManifest(installDir);
  if (manifest?.dependencies && manifest.dependencies.length > 0) {
    console.log(`\nResolving dependencies for ${packageName}...`);
    await resolveDependencies(manifest.dependencies, packageName, {
      installRegistryDep: async (depPkgName: string) => {
        const depDetected: RegistryDetectedSource = { type: 'registry', packageName: depPkgName };
        await installFromRegistry(depDetected, { ...options, force: false });
        return [];
      },
      installGitHubRepoDep: async (owner: string, repo: string) => {
        await installViaGitClone(`${owner}/${repo}`, { ...options, all: true, force: false });
      },
      installGitHubSkillDep: async (owner: string, repo: string, skillName: string) => {
        const repoUrl = `https://github.com/${owner}/${repo}`;
        await installViaGitClone(repoUrl, { ...options, skill: [skillName], force: false });
      },
      readInstalledManifest: (dep: ParsedDependency): SkillManifest | null => {
        if (dep.type === 'registry') {
          return readManifest(join(SKILLS_MANAGER_DIR, 'registry', dep.packageName));
        }
        return null;
      },
    });
  }

  return createInstallResult(installedPaths, sourceKeys);
}

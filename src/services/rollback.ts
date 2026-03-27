import { SourcesService } from './sources.js';
import { removeDir } from '../utils/fs.js';

export function rollbackInstall(
  basePath: string,
  sourceKey: string,
  installedPaths: string[] = [],
  sourceKeys: string[] = [],
): void {
  const sourcesService = new SourcesService();
  const pathsToRemove = installedPaths.length > 0 ? [...new Set(installedPaths)] : (basePath ? [basePath] : []);
  const keysToRemove = sourceKeys.length > 0 ? [...new Set(sourceKeys)] : (sourceKey ? [sourceKey] : []);

  for (const path of pathsToRemove) {
    try {
      removeDir(path);
    } catch (error) {
      console.warn(`Warning: Failed to remove ${path}: ${error instanceof Error ? error.message : error}`);
    }
  }

  for (const key of keysToRemove) {
    try {
      sourcesService.removeSource(key);
    } catch (error) {
      console.warn(`Warning: Failed to clean sources.json for ${key}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('Installation rolled back.');
}

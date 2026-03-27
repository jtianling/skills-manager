import { SourcesService } from './sources.js';
import { removeDir } from '../utils/fs.js';

export function rollbackInstall(basePath: string, sourceKey: string): void {
  const sourcesService = new SourcesService();

  try {
    removeDir(basePath);
  } catch (error) {
    console.warn(`Warning: Failed to remove ${basePath}: ${error instanceof Error ? error.message : error}`);
  }

  try {
    sourcesService.removeSource(sourceKey);
  } catch (error) {
    console.warn(`Warning: Failed to clean sources.json for ${sourceKey}: ${error instanceof Error ? error.message : error}`);
  }

  console.log('Installation rolled back.');
}

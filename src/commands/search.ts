import { Command } from 'commander';
import { RegistryService } from '../services/registry.js';
import type { SearchResultObject } from '../types.js';
import { jsonOutput, jsonError } from '../utils/json-output.js';

const registryService = new RegistryService();

function formatResults(objects: SearchResultObject[]): void {
  if (objects.length === 0) {
    return;
  }

  const nameWidth = Math.max(4, ...objects.map((o) => o.package.name.length));
  const versionWidth = Math.max(7, ...objects.map((o) => o.package.version.length));
  const maxDescWidth = Math.max(20, (process.stdout.columns || 80) - nameWidth - versionWidth - 10);

  const header = [
    'NAME'.padEnd(nameWidth),
    'VERSION'.padEnd(versionWidth),
    'DESCRIPTION',
  ].join('  ');
  console.log(header);

  for (const obj of objects) {
    const pkg = obj.package;
    const desc = pkg.description
      ? pkg.description.length > maxDescWidth
        ? pkg.description.substring(0, maxDescWidth - 1) + '…'
        : pkg.description
      : '';

    const line = [
      pkg.name.padEnd(nameWidth),
      pkg.version.padEnd(versionWidth),
      desc,
    ].join('  ');
    console.log(line);
  }
}

interface SearchOptions {
  size?: string;
  from?: string;
  json?: boolean;
}

export async function executeSearch(query: string | undefined, options: SearchOptions): Promise<void> {
  try {
    const result = await registryService.search(query || '', {
      size: options.size ? parseInt(options.size, 10) : undefined,
      from: options.from ? parseInt(options.from, 10) : undefined,
    });

    if (options.json) {
      jsonOutput({
        results: result.objects.map((o) => ({
          name: o.package.name,
          version: o.package.version,
          description: o.package.description,
        })),
        total: result.total,
      });
      return;
    }

    if (result.objects.length === 0) {
      console.log(query ? `No skills found for "${query}"` : 'No skills found');
      return;
    }

    formatResults(result.objects);
    console.log(`\n${result.objects.length} of ${result.total} results`);
  } catch (error) {
    if (options.json) {
      jsonError(error instanceof Error ? error.message : 'Unknown error', 'SEARCH_ERROR');
      process.exit(1);
    }
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

export const searchCommand = new Command('search')
  .description('Search for skills in the skillsmgr.dev registry')
  .argument('[query]', 'Search query')
  .option('--size <n>', 'Number of results per page', '20')
  .option('--from <n>', 'Offset for pagination')
  .option('--json', 'Output as JSON')
  .action(async (query: string | undefined, options: SearchOptions) => {
    await executeSearch(query, options);
  });

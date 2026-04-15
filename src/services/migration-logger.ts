import { appendFileSync } from 'fs';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { ensureDir } from '../utils/fs.js';

let bannerPrinted = false;

function appendLine(line: string): void {
  ensureDir(SKILLS_MANAGER_DIR);
  appendFileSync(join(SKILLS_MANAGER_DIR, 'migration.log'), `${line}\n`, 'utf-8');
}

export function logMigrationLines(lines: string[]): void {
  if (lines.length === 0) {
    return;
  }

  if (!bannerPrinted) {
    bannerPrinted = true;
    const banner = 'Migrating skills-manager data...';
    console.error(banner);
    appendLine(banner);
  }

  for (const line of lines) {
    console.error(line);
    appendLine(line);
  }
}

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

export function getInstalledSkillNames(repoDir: string): string[] {
  const skillsSubdir = join(repoDir, 'skills');
  const scanDir = existsSync(skillsSubdir) ? skillsSubdir : repoDir;

  if (!existsSync(scanDir)) return [];
  return readdirSync(scanDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && existsSync(join(scanDir, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

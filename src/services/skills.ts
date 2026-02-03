import { join } from 'path';
import { SkillInfo, SkillSource } from '../types.js';
import { SKILL_SOURCES } from '../constants.js';
import { getDirectoriesInDir, fileExists, readFileContent } from '../utils/fs.js';

export class SkillsService {
  constructor(private skillsDir: string) {}

  getAllSkills(): SkillInfo[] {
    const skills: SkillInfo[] = [];

    for (const source of SKILL_SOURCES) {
      const sourceDir = join(this.skillsDir, source);
      const sourceSkills = this.getSkillsFromSource(sourceDir, source);
      skills.push(...sourceSkills);
    }

    return skills;
  }

  getSkillsBySource(source: SkillSource): SkillInfo[] {
    const sourceDir = join(this.skillsDir, source);
    return this.getSkillsFromSource(sourceDir, source);
  }

  getSkillByName(name: string): SkillInfo | undefined {
    const allSkills = this.getAllSkills();
    return allSkills.find((s) => s.name === name);
  }

  getSkillsByNames(names: string[]): SkillInfo[] {
    const allSkills = this.getAllSkills();
    return names
      .map((name) => allSkills.find((s) => s.name === name))
      .filter((s): s is SkillInfo => s !== undefined);
  }

  findSkillsByName(name: string): SkillInfo[] {
    const allSkills = this.getAllSkills();
    return allSkills.filter((s) => s.name === name);
  }

  private getSkillsFromSource(sourceDir: string, sourcePrefix: string): SkillInfo[] {
    const skills: SkillInfo[] = [];

    if (!fileExists(sourceDir)) {
      return skills;
    }

    // For official and community, we have an extra level (e.g., official/anthropic/skill-name)
    // For custom, skills are directly under custom/skill-name
    if (sourcePrefix === 'custom') {
      const skillDirs = getDirectoriesInDir(sourceDir);
      for (const skillDir of skillDirs) {
        const skill = this.loadSkill(skillDir.path, sourcePrefix);
        if (skill) {
          skills.push(skill);
        }
      }
    } else {
      // official or community - has repo subdirectories
      const repoDirs = getDirectoriesInDir(sourceDir);
      for (const repoDir of repoDirs) {
        // Check if skills are in a 'skills/' subdirectory (e.g., anthropic/skills repo structure)
        const skillsSubdir = join(repoDir.path, 'skills');
        const searchDir = fileExists(skillsSubdir) ? skillsSubdir : repoDir.path;

        const skillDirs = getDirectoriesInDir(searchDir);
        for (const skillDir of skillDirs) {
          const source = `${sourcePrefix}/${repoDir.name}`;
          const skill = this.loadSkill(skillDir.path, source);
          if (skill) {
            skills.push(skill);
          }
        }
      }
    }

    return skills;
  }

  private loadSkill(skillPath: string, source: string): SkillInfo | undefined {
    const skillMdPath = join(skillPath, 'SKILL.md');
    if (!fileExists(skillMdPath)) {
      return undefined;
    }

    const content = readFileContent(skillMdPath);
    const { name, description } = this.parseSkillMd(content);

    return {
      name: name || skillPath.split('/').pop() || '',
      description: description || '',
      path: skillPath,
      source,
    };
  }

  private parseSkillMd(content: string): { name: string; description: string } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return { name: '', description: '' };
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      description: descMatch ? descMatch[1].trim() : '',
    };
  }
}

import { join } from 'path';
import { CommandInfo, SkillSource } from '../types.js';
import { SKILL_SOURCES } from '../constants.js';
import { getDirectoriesInDir, getFilesInDir, fileExists, readFileContent } from '../utils/fs.js';

export class CommandsService {
  constructor(private skillsDir: string) {}

  getAllCommands(): CommandInfo[] {
    const commands: CommandInfo[] = [];

    for (const source of SKILL_SOURCES) {
      const sourceDir = join(this.skillsDir, source);
      const sourceCommands = this.getCommandsFromSource(sourceDir, source);
      commands.push(...sourceCommands);
    }

    return commands;
  }

  getCommandsBySource(source: SkillSource): CommandInfo[] {
    const sourceDir = join(this.skillsDir, source);
    return this.getCommandsFromSource(sourceDir, source);
  }

  getCommandByName(name: string): CommandInfo | undefined {
    const allCommands = this.getAllCommands();
    return allCommands.find((c) => c.name === name);
  }

  getCommandsByNames(names: string[]): CommandInfo[] {
    const allCommands = this.getAllCommands();
    return names
      .map((name) => allCommands.find((c) => c.name === name))
      .filter((c): c is CommandInfo => c !== undefined);
  }

  findCommandsByName(name: string): CommandInfo[] {
    const allCommands = this.getAllCommands();
    return allCommands.filter((c) => c.name === name);
  }

  private getCommandsFromSource(sourceDir: string, sourcePrefix: string): CommandInfo[] {
    const commands: CommandInfo[] = [];

    if (!fileExists(sourceDir)) {
      return commands;
    }

    if (sourcePrefix === 'custom') {
      // For custom, commands are in custom/commands/
      const commandsDir = join(sourceDir, 'commands');
      const customCommands = this.loadCommandsFromDir(commandsDir, sourcePrefix);
      commands.push(...customCommands);
    } else {
      // official or community - has repo subdirectories
      const repoDirs = getDirectoriesInDir(sourceDir);
      for (const repoDir of repoDirs) {
        const source = `${sourcePrefix}/${repoDir.name}`;

        // Check for commands/ subdirectory
        const commandsDir = join(repoDir.path, 'commands');
        const repoCommands = this.loadCommandsFromDir(commandsDir, source);
        commands.push(...repoCommands);
      }
    }

    return commands;
  }

  private loadCommandsFromDir(commandsDir: string, source: string): CommandInfo[] {
    const commands: CommandInfo[] = [];

    if (!fileExists(commandsDir)) {
      return commands;
    }

    const mdFiles = getFilesInDir(commandsDir, '.md');
    for (const file of mdFiles) {
      const command = this.loadCommand(file.path, file.name, source);
      if (command) {
        commands.push(command);
      }
    }

    return commands;
  }

  private loadCommand(filePath: string, fileName: string, source: string): CommandInfo | undefined {
    const content = readFileContent(filePath);
    const { name, description } = this.parseCommandMd(content);
    const commandName = name || fileName.replace(/\.md$/, '');

    return {
      name: commandName,
      description: description || '',
      path: filePath,
      source,
    };
  }

  private parseCommandMd(content: string): { name: string; description: string } {
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

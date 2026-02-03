import { join } from 'path';
import { ProjectMetadata, DeployedSkill, ToolDeployment } from '../types.js';
import { METADATA_FILENAME } from '../constants.js';
import { fileExists, readFileContent, writeFile } from '../utils/fs.js';

export class MetadataService {
  private metadataPath: string;

  constructor(private projectDir: string) {
    this.metadataPath = join(projectDir, METADATA_FILENAME);
  }

  load(): ProjectMetadata {
    if (!fileExists(this.metadataPath)) {
      return { version: '1.0', tools: {} };
    }

    const content = readFileContent(this.metadataPath);
    return JSON.parse(content) as ProjectMetadata;
  }

  save(metadata: ProjectMetadata): void {
    writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  addDeployment(
    toolName: string,
    targetDir: string,
    mode: string,
    skills: DeployedSkill[]
  ): void {
    const metadata = this.load();
    metadata.tools[toolName] = {
      targetDir,
      mode,
      deployedAt: new Date().toISOString(),
      skills,
    };
    this.save(metadata);
  }

  updateDeployment(toolName: string, skills: DeployedSkill[]): void {
    const metadata = this.load();
    if (metadata.tools[toolName]) {
      metadata.tools[toolName].skills = skills;
      metadata.tools[toolName].deployedAt = new Date().toISOString();
    }
    this.save(metadata);
  }

  removeDeployment(toolName: string): void {
    const metadata = this.load();
    delete metadata.tools[toolName];
    this.save(metadata);
  }

  getDeployedSkills(toolName: string): DeployedSkill[] {
    const metadata = this.load();
    return metadata.tools[toolName]?.skills || [];
  }

  getToolDeployment(toolName: string): ToolDeployment | undefined {
    const metadata = this.load();
    return metadata.tools[toolName];
  }

  getConfiguredTools(): string[] {
    const metadata = this.load();
    return Object.keys(metadata.tools);
  }

  hasMetadata(): boolean {
    return fileExists(this.metadataPath);
  }
}

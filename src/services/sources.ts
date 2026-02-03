import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { fileExists, readFileContent, writeFile } from '../utils/fs.js';

const SOURCES_FILE = join(SKILLS_MANAGER_DIR, 'sources.json');

export interface SourceInfo {
  url: string;
  type: 'official' | 'community' | 'custom';
  repoName: string;
  installedAt: string;
  updatedAt: string;
}

export interface SourcesData {
  version: string;
  sources: Record<string, SourceInfo>;
}

export class SourcesService {
  private load(): SourcesData {
    if (!fileExists(SOURCES_FILE)) {
      return { version: '1.0', sources: {} };
    }

    const content = readFileContent(SOURCES_FILE);
    return JSON.parse(content) as SourcesData;
  }

  private save(data: SourcesData): void {
    writeFile(SOURCES_FILE, JSON.stringify(data, null, 2));
  }

  addSource(key: string, info: Omit<SourceInfo, 'installedAt' | 'updatedAt'>): void {
    const data = this.load();
    const now = new Date().toISOString();

    data.sources[key] = {
      ...info,
      installedAt: data.sources[key]?.installedAt || now,
      updatedAt: now,
    };

    this.save(data);
  }

  getSource(key: string): SourceInfo | undefined {
    const data = this.load();
    return data.sources[key];
  }

  getAllSources(): Record<string, SourceInfo> {
    const data = this.load();
    return data.sources;
  }

  removeSource(key: string): void {
    const data = this.load();
    delete data.sources[key];
    this.save(data);
  }

  updateTimestamp(key: string): void {
    const data = this.load();
    if (data.sources[key]) {
      data.sources[key].updatedAt = new Date().toISOString();
      this.save(data);
    }
  }
}

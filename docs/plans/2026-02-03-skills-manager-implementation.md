# Skills Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool (skillsmgr) that manages AI coding assistant skills across multiple tools.

**Architecture:** TypeScript CLI using Commander.js for commands and Inquirer for interactive prompts. Skills are stored in `~/.skills-manager/` organized by source (official/community/custom) and deployed to project directories via symlinks or copies. Deployment state tracked via `.skillsmgr.json`.

**Tech Stack:** TypeScript, Commander.js, Inquirer, tsup, Vitest, Node.js 18+

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "skillsmgr",
  "version": "0.1.0",
  "description": "Unified skills manager for AI coding tools",
  "type": "module",
  "bin": {
    "skillsmgr": "./dist/index.js"
  },
  "files": [
    "dist",
    "src/templates"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "ai",
    "skills",
    "claude-code",
    "cursor",
    "windsurf",
    "cline",
    "cli"
  ],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "inquirer": "^13.2.0"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.9",
    "@types/node": "^22.0.0",
    "tsup": "^8.5.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';
import { cpSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    cpSync(
      join(process.cwd(), 'src', 'templates'),
      join(process.cwd(), 'dist', 'templates'),
      { recursive: true }
    );
    console.log('Templates copied to dist/templates');
  },
});
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
  },
});
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 6: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, package-lock.json created

**Step 7: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore package-lock.json
git commit -m "chore: initial project setup with build configuration"
```

---

## Task 2: Constants and Types

**Files:**
- Create: `src/constants.ts`
- Create: `src/types.ts`

**Step 1: Create src/constants.ts**

```typescript
import { homedir } from 'os';
import { join } from 'path';

export const SKILLS_MANAGER_DIR = join(homedir(), '.skills-manager');
export const METADATA_FILENAME = '.skillsmgr.json';

export const SKILL_SOURCES = ['official', 'community', 'custom'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export const SUPPORTED_TOOLS = [
  'claude-code',
  'cursor',
  'windsurf',
  'cline',
  'roo-code',
  'kilo-code',
  'antigravity',
] as const;

export type ToolName = (typeof SUPPORTED_TOOLS)[number];

export const ANTHROPIC_SKILLS_REPO = 'https://github.com/anthropics/skills';
```

**Step 2: Create src/types.ts**

```typescript
import { ToolName, SkillSource } from './constants.js';

export { ToolName, SkillSource };

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  source: string; // e.g., "official/anthropic" or "community/awesome-skills"
}

export interface DeployedSkill {
  name: string;
  source: string;
  deployMode: 'link' | 'copy';
}

export interface ToolDeployment {
  targetDir: string;
  mode: string; // "all" or specific mode like "code", "architect"
  deployedAt: string;
  skills: DeployedSkill[];
}

export interface ProjectMetadata {
  version: string;
  tools: Record<string, ToolDeployment>;
}

export interface ToolConfig {
  name: ToolName;
  displayName: string;
  skillsDir: string;
  supportsLink: boolean;
  supportsModeSpecific: boolean;
  modePattern?: string;
  availableModes?: string[];
}

export interface InstallOptions {
  all?: boolean;
  custom?: boolean;
}

export interface InitOptions {
  copy?: boolean;
}

export interface AddOptions {
  tool?: string;
  copy?: boolean;
}

export interface RemoveOptions {
  tool?: string;
}

export interface ListOptions {
  deployed?: boolean;
}
```

**Step 3: Commit**

```bash
git add src/constants.ts src/types.ts
git commit -m "feat: add constants and type definitions"
```

---

## Task 3: Tool Configurations

**Files:**
- Create: `src/tools/configs.ts`

**Step 1: Create src/tools/configs.ts**

```typescript
import { ToolConfig, ToolName } from '../types.js';

export const TOOL_CONFIGS: Record<ToolName, ToolConfig> = {
  'claude-code': {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'cursor': {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'windsurf': {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'cline': {
    name: 'cline',
    displayName: 'Cline',
    skillsDir: '.cline/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
  'roo-code': {
    name: 'roo-code',
    displayName: 'Roo Code',
    skillsDir: '.roo/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  'kilo-code': {
    name: 'kilo-code',
    displayName: 'Kilo Code',
    skillsDir: '.kilocode/skills',
    supportsLink: true,
    supportsModeSpecific: true,
    modePattern: 'skills-{mode}',
    availableModes: ['code', 'architect'],
  },
  'antigravity': {
    name: 'antigravity',
    displayName: 'Antigravity',
    skillsDir: '.agent/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  },
};

export function getToolConfig(name: string): ToolConfig | undefined {
  return TOOL_CONFIGS[name as ToolName];
}

export function getTargetDir(config: ToolConfig, mode?: string): string {
  if (config.supportsModeSpecific && mode && mode !== 'all' && config.modePattern) {
    const baseDir = config.skillsDir.split('/').slice(0, -1).join('/');
    return `${baseDir}/${config.modePattern.replace('{mode}', mode)}`;
  }
  return config.skillsDir;
}
```

**Step 2: Commit**

```bash
git add src/tools/configs.ts
git commit -m "feat: add tool configurations for 7 AI coding tools"
```

---

## Task 4: File System Utilities

**Files:**
- Create: `src/utils/fs.ts`
- Create: `src/utils/fs.test.ts`

**Step 1: Write the failing test**

```typescript
// src/utils/fs.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureDir, copyFile, linkFile, isSymlink, readFileContent, fileExists, getDirectoriesInDir } from './fs.js';

describe('fs utils', () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('creates directory if not exists', () => {
      const dir = join(testDir, 'new-dir');
      ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });

    it('does nothing if directory exists', () => {
      const dir = join(testDir, 'existing-dir');
      mkdirSync(dir);
      ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('copyFile', () => {
    it('copies file to destination', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest', 'copied.txt');
      writeFileSync(src, 'content');
      copyFile(src, dest);
      expect(readFileSync(dest, 'utf-8')).toBe('content');
    });
  });

  describe('linkFile', () => {
    it('creates symlink to source', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'link.txt');
      writeFileSync(src, 'content');
      linkFile(src, dest);
      expect(isSymlink(dest)).toBe(true);
      expect(readFileSync(dest, 'utf-8')).toBe('content');
    });

    it('replaces existing file with symlink', () => {
      const src = join(testDir, 'source.txt');
      const dest = join(testDir, 'existing.txt');
      writeFileSync(src, 'new content');
      writeFileSync(dest, 'old content');
      linkFile(src, dest);
      expect(isSymlink(dest)).toBe(true);
    });
  });

  describe('getDirectoriesInDir', () => {
    it('returns only directories', () => {
      mkdirSync(join(testDir, 'dir1'));
      mkdirSync(join(testDir, 'dir2'));
      writeFileSync(join(testDir, 'file.txt'), 'content');
      const dirs = getDirectoriesInDir(testDir);
      expect(dirs.map(d => d.name).sort()).toEqual(['dir1', 'dir2']);
    });

    it('returns empty array for non-existent directory', () => {
      const dirs = getDirectoriesInDir(join(testDir, 'nonexistent'));
      expect(dirs).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/fs.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/utils/fs.ts
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
  lstatSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

export function linkFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  symlinkSync(src, dest);
}

export function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function readFileContent(path: string): string {
  return readFileSync(path, 'utf-8');
}

export function writeFile(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf-8');
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function removeFile(path: string): void {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function removeDir(dir: string): void {
  if (existsSync(dir)) {
    const { rmSync } = require('fs');
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface DirInfo {
  name: string;
  path: string;
}

export function getDirectoriesInDir(dir: string): DirInfo[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      path: join(dir, e.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function copyDir(src: string, dest: string): void {
  ensureDir(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

export function linkDir(src: string, dest: string): void {
  ensureDir(dirname(dest));
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  symlinkSync(src, dest);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/fs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/fs.ts src/utils/fs.test.ts
git commit -m "feat: add file system utilities with tests"
```

---

## Task 5: Skills Service

**Files:**
- Create: `src/services/skills.ts`
- Create: `src/services/skills.test.ts`

**Step 1: Write the failing test**

```typescript
// src/services/skills.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SkillsService } from './skills.js';

describe('SkillsService', () => {
  const testDir = join(tmpdir(), `skillsmgr-test-${Date.now()}`);
  let service: SkillsService;

  beforeEach(() => {
    mkdirSync(join(testDir, 'official', 'anthropic', 'code-review'), { recursive: true });
    mkdirSync(join(testDir, 'community', 'awesome', 'react-patterns'), { recursive: true });
    mkdirSync(join(testDir, 'custom', 'my-skill'), { recursive: true });

    writeFileSync(
      join(testDir, 'official', 'anthropic', 'code-review', 'SKILL.md'),
      '---\nname: code-review\ndescription: Reviews code\n---\n# Code Review'
    );
    writeFileSync(
      join(testDir, 'community', 'awesome', 'react-patterns', 'SKILL.md'),
      '---\nname: react-patterns\ndescription: React patterns\n---\n# React'
    );
    writeFileSync(
      join(testDir, 'custom', 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: My custom skill\n---\n# My Skill'
    );

    service = new SkillsService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getAllSkills', () => {
    it('returns skills from all sources', () => {
      const skills = service.getAllSkills();
      expect(skills.length).toBe(3);
    });

    it('includes correct source paths', () => {
      const skills = service.getAllSkills();
      const sources = skills.map((s) => s.source).sort();
      expect(sources).toEqual([
        'community/awesome',
        'custom',
        'official/anthropic',
      ]);
    });
  });

  describe('getSkillByName', () => {
    it('finds skill by name', () => {
      const skill = service.getSkillByName('code-review');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('code-review');
    });

    it('returns undefined for unknown skill', () => {
      const skill = service.getSkillByName('unknown');
      expect(skill).toBeUndefined();
    });
  });

  describe('parseSkillMd', () => {
    it('extracts name and description from frontmatter', () => {
      const skill = service.getSkillByName('code-review');
      expect(skill?.name).toBe('code-review');
      expect(skill?.description).toBe('Reviews code');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/skills.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/services/skills.ts
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
        const skillDirs = getDirectoriesInDir(repoDir.path);
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/skills.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/skills.ts src/services/skills.test.ts
git commit -m "feat: add SkillsService for managing skills"
```

---

## Task 6: Deployer Service

**Files:**
- Create: `src/services/deployer.ts`
- Create: `src/services/deployer.test.ts`

**Step 1: Write the failing test**

```typescript
// src/services/deployer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Deployer } from './deployer.js';
import { SkillInfo, ToolConfig } from '../types.js';
import { isSymlink } from '../utils/fs.js';

describe('Deployer', () => {
  const testDir = join(tmpdir(), `skillsmgr-deployer-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');
  const skillsDir = join(testDir, 'skills-manager');
  let deployer: Deployer;

  const mockSkill: SkillInfo = {
    name: 'test-skill',
    description: 'Test skill',
    path: '',
    source: 'official/anthropic',
  };

  const mockToolConfig: ToolConfig = {
    name: 'claude-code',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills',
    supportsLink: true,
    supportsModeSpecific: false,
  };

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(skillsDir, 'official', 'anthropic', 'test-skill'), { recursive: true });
    writeFileSync(
      join(skillsDir, 'official', 'anthropic', 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n# Test'
    );
    mockSkill.path = join(skillsDir, 'official', 'anthropic', 'test-skill');
    deployer = new Deployer(projectDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('deploySkill', () => {
    it('creates symlink in link mode', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'link');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(true);
    });

    it('copies directory in copy mode', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'copy');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      expect(isSymlink(targetPath)).toBe(false);
      expect(existsSync(join(targetPath, 'SKILL.md'))).toBe(true);
    });
  });

  describe('removeSkill', () => {
    it('removes deployed skill', () => {
      deployer.deploySkill(mockSkill, mockToolConfig, 'link');
      const targetPath = join(projectDir, '.claude', 'skills', 'test-skill');
      expect(existsSync(targetPath)).toBe(true);
      deployer.removeSkill('test-skill', mockToolConfig);
      expect(existsSync(targetPath)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/deployer.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/services/deployer.ts
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { SkillInfo, ToolConfig } from '../types.js';
import { ensureDir, linkDir, copyDir } from '../utils/fs.js';
import { getTargetDir } from '../tools/configs.js';

export class Deployer {
  constructor(private projectDir: string) {}

  deploySkill(
    skill: SkillInfo,
    toolConfig: ToolConfig,
    mode: 'link' | 'copy',
    targetMode?: string
  ): void {
    const targetDir = getTargetDir(toolConfig, targetMode);
    const fullTargetDir = join(this.projectDir, targetDir);
    ensureDir(fullTargetDir);

    const skillTargetPath = join(fullTargetDir, skill.name);

    if (mode === 'link') {
      linkDir(skill.path, skillTargetPath);
    } else {
      copyDir(skill.path, skillTargetPath);
    }
  }

  deploySkills(
    skills: SkillInfo[],
    toolConfig: ToolConfig,
    mode: 'link' | 'copy',
    targetMode?: string
  ): void {
    for (const skill of skills) {
      this.deploySkill(skill, toolConfig, mode, targetMode);
    }
  }

  removeSkill(skillName: string, toolConfig: ToolConfig, targetMode?: string): void {
    const targetDir = getTargetDir(toolConfig, targetMode);
    const skillPath = join(this.projectDir, targetDir, skillName);
    if (existsSync(skillPath)) {
      rmSync(skillPath, { recursive: true, force: true });
    }
  }

  getDeployedSkillPath(skillName: string, toolConfig: ToolConfig, targetMode?: string): string {
    const targetDir = getTargetDir(toolConfig, targetMode);
    return join(this.projectDir, targetDir, skillName);
  }

  isSkillDeployed(skillName: string, toolConfig: ToolConfig, targetMode?: string): boolean {
    const skillPath = this.getDeployedSkillPath(skillName, toolConfig, targetMode);
    return existsSync(skillPath);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/deployer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/deployer.ts src/services/deployer.test.ts
git commit -m "feat: add Deployer service for skill deployment"
```

---

## Task 7: Metadata Service

**Files:**
- Create: `src/services/metadata.ts`
- Create: `src/services/metadata.test.ts`

**Step 1: Write the failing test**

```typescript
// src/services/metadata.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MetadataService } from './metadata.js';

describe('MetadataService', () => {
  const testDir = join(tmpdir(), `skillsmgr-metadata-test-${Date.now()}`);
  let service: MetadataService;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    service = new MetadataService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('returns default metadata if file does not exist', () => {
      const metadata = service.load();
      expect(metadata.version).toBe('1.0');
      expect(metadata.tools).toEqual({});
    });
  });

  describe('save', () => {
    it('creates metadata file', () => {
      service.save({ version: '1.0', tools: {} });
      expect(existsSync(join(testDir, '.skillsmgr.json'))).toBe(true);
    });
  });

  describe('addDeployment', () => {
    it('adds tool deployment', () => {
      service.addDeployment('claude-code', '.claude/skills', 'all', [
        { name: 'test-skill', source: 'official/anthropic', deployMode: 'link' },
      ]);
      const metadata = service.load();
      expect(metadata.tools['claude-code']).toBeDefined();
      expect(metadata.tools['claude-code'].skills.length).toBe(1);
    });
  });

  describe('getDeployedSkills', () => {
    it('returns deployed skills for tool', () => {
      service.addDeployment('claude-code', '.claude/skills', 'all', [
        { name: 'test-skill', source: 'official/anthropic', deployMode: 'link' },
      ]);
      const skills = service.getDeployedSkills('claude-code');
      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('test-skill');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/metadata.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/services/metadata.ts
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/metadata.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/metadata.ts src/services/metadata.test.ts
git commit -m "feat: add MetadataService for tracking deployments"
```

---

## Task 8: Interactive Prompts

**Files:**
- Create: `src/utils/prompts.ts`

**Step 1: Create src/utils/prompts.ts**

```typescript
import inquirer from 'inquirer';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ToolName, SkillInfo } from '../types.js';
import { SUPPORTED_TOOLS } from '../constants.js';

export async function promptTools(configuredTools?: string[]): Promise<string[]> {
  const choices = SUPPORTED_TOOLS.map((tool) => {
    const config = TOOL_CONFIGS[tool];
    const isConfigured = configuredTools?.includes(tool);
    return {
      name: isConfigured ? `${config.displayName} [configured]` : config.displayName,
      value: tool,
      checked: isConfigured,
    };
  });

  const { tools } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Select target tools:',
      choices,
      validate: (answer: string[]) => {
        if (answer.length === 0) {
          return 'You must select at least one tool.';
        }
        return true;
      },
    },
  ]);

  return tools;
}

export async function promptMode(toolName: string, modes: string[]): Promise<string> {
  const config = TOOL_CONFIGS[toolName as ToolName];
  const choices = [
    { name: `All modes (${config.skillsDir}/)`, value: 'all' },
    ...modes.map((mode) => ({
      name: `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode only (${config.skillsDir.replace('skills', `skills-${mode}`)}/)`,
      value: mode,
    })),
  ];

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: `Select target mode for ${config.displayName}:`,
      choices,
    },
  ]);

  return mode;
}

export async function promptSkills(
  skills: SkillInfo[],
  deployedSkillNames: string[] = []
): Promise<string[]> {
  // Group skills by source
  const grouped: Record<string, SkillInfo[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  const choices: Array<{ name: string; value: string; checked?: boolean } | inquirer.Separator> = [];

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    choices.push(new inquirer.Separator(`── ${source} ──`));
    for (const skill of sourceSkills) {
      const isDeployed = deployedSkillNames.includes(skill.name);
      choices.push({
        name: isDeployed
          ? `${skill.name.padEnd(20)} [deployed]  ${skill.description}`
          : `${skill.name.padEnd(20)} ${skill.description}`,
        value: skill.name,
        checked: isDeployed,
      });
    }
  }

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Select skills to deploy:',
      choices,
      pageSize: 20,
    },
  ]);

  return selectedSkills;
}

export async function promptSkillsToInstall(
  skills: Array<{ name: string; description: string }>
): Promise<string[]> {
  const choices = skills.map((skill) => ({
    name: `${skill.name.padEnd(20)} ${skill.description}`,
    value: skill.name,
  }));

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Select skills to install:',
      choices,
      pageSize: 20,
    },
  ]);

  return selectedSkills;
}

export async function promptConfirm(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true,
    },
  ]);

  return confirmed;
}

export async function promptSelect<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
    },
  ]);

  return selected;
}

export async function promptSyncAction(
  filename: string
): Promise<'overwrite' | 'skip' | 'diff'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `${filename}: source changed`,
      choices: [
        { name: 'Overwrite', value: 'overwrite' },
        { name: 'Skip', value: 'skip' },
        { name: 'Show diff', value: 'diff' },
      ],
    },
  ]);

  return action;
}

export async function promptOrphanAction(
  skillName: string
): Promise<'remove' | 'keep'> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `${skillName}: source no longer exists`,
      choices: [
        { name: 'Remove', value: 'remove' },
        { name: 'Keep', value: 'keep' },
      ],
    },
  ]);

  return action;
}
```

**Step 2: Commit**

```bash
git add src/utils/prompts.ts
git commit -m "feat: add interactive prompts for CLI"
```

---

## Task 9: Git Service

**Files:**
- Create: `src/services/git.ts`

**Step 1: Create src/services/git.ts**

```typescript
import { execSync } from 'child_process';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { ANTHROPIC_SKILLS_REPO, SKILLS_MANAGER_DIR } from '../constants.js';
import { ensureDir } from '../utils/fs.js';

export class GitService {
  /**
   * Clone a git repository to the skills manager directory
   * @param url Git URL or 'anthropic' shorthand
   * @param isCustom Whether to install to custom/ instead of community/
   * @returns Path where repo was cloned
   */
  clone(url: string, isCustom: boolean = false): string {
    const actualUrl = url === 'anthropic' ? ANTHROPIC_SKILLS_REPO : url;
    const repoName = this.extractRepoName(actualUrl);

    // Determine target directory
    let targetDir: string;
    if (url === 'anthropic') {
      targetDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
    } else if (isCustom) {
      targetDir = join(SKILLS_MANAGER_DIR, 'custom', repoName);
    } else {
      targetDir = join(SKILLS_MANAGER_DIR, 'community', repoName);
    }

    // If already exists, do a pull instead
    if (existsSync(targetDir)) {
      console.log(`Updating existing ${repoName}...`);
      execSync('git pull', { cwd: targetDir, stdio: 'inherit' });
      return targetDir;
    }

    // Clone the repo
    ensureDir(join(targetDir, '..'));
    console.log(`Cloning ${repoName}...`);
    execSync(`git clone --depth 1 "${actualUrl}" "${targetDir}"`, {
      stdio: 'inherit',
    });

    return targetDir;
  }

  /**
   * Clone a specific skill from a repository
   * @param url Git URL with path to specific skill (e.g., https://github.com/org/repo/tree/main/skill-name)
   * @param isCustom Whether to install to custom/
   * @returns Path where skill was cloned
   */
  cloneSpecificSkill(url: string, isCustom: boolean = false): string | null {
    // Parse GitHub tree URL
    const match = url.match(
      /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
    );
    if (!match) {
      return null;
    }

    const [, owner, repo, branch, skillPath] = match;
    const skillName = basename(skillPath);
    const repoUrl = `https://github.com/${owner}/${repo}`;

    // Determine if this is the official anthropic repo
    const isAnthropic = owner === 'anthropics' && repo === 'skills';

    let targetDir: string;
    if (isAnthropic) {
      targetDir = join(SKILLS_MANAGER_DIR, 'official', 'anthropic');
    } else if (isCustom) {
      targetDir = join(SKILLS_MANAGER_DIR, 'custom', repo);
    } else {
      targetDir = join(SKILLS_MANAGER_DIR, 'community', repo);
    }

    const skillTargetDir = join(targetDir, skillName);

    // Use sparse checkout to get only the specific skill
    ensureDir(targetDir);

    if (!existsSync(join(targetDir, '.git'))) {
      execSync(`git init`, { cwd: targetDir, stdio: 'pipe' });
      execSync(`git remote add origin "${repoUrl}"`, {
        cwd: targetDir,
        stdio: 'pipe',
      });
    }

    execSync(`git config core.sparseCheckout true`, {
      cwd: targetDir,
      stdio: 'pipe',
    });
    execSync(`echo "${skillPath}" >> .git/info/sparse-checkout`, {
      cwd: targetDir,
      stdio: 'pipe',
    });
    execSync(`git pull --depth 1 origin ${branch}`, {
      cwd: targetDir,
      stdio: 'inherit',
    });

    return skillTargetDir;
  }

  private extractRepoName(url: string): string {
    // Handle various URL formats
    const match = url.match(/\/([^/]+?)(\.git)?$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Check if a URL points to a specific skill (vs a repository)
   */
  isSpecificSkillUrl(url: string): boolean {
    return url.includes('/tree/');
  }
}
```

**Step 2: Commit**

```bash
git add src/services/git.ts
git commit -m "feat: add GitService for cloning skill repositories"
```

---

## Task 10: Example Skill Template

**Files:**
- Create: `src/templates/example-skill/SKILL.md`

**Step 1: Create src/templates/example-skill/SKILL.md**

```markdown
---
name: example-skill
description: An example skill template. Use when you want to understand how to create custom skills.
---

# Example Skill

This is a template to help you create your own skills.

## SKILL.md Structure

Every skill needs a `SKILL.md` file with two parts:

1. **YAML Frontmatter** (between `---` markers)
   - `name`: Short identifier for the skill
   - `description`: Explains what the skill does and when to use it

2. **Markdown Content**
   - Instructions the AI follows when the skill is invoked

## Tips for Writing Skills

- Be specific in the description - it determines when the skill activates
- Keep instructions clear and actionable
- You can add supporting files (scripts, templates) in the same directory

## Directory Structure

```
my-skill/
├── SKILL.md           # Required: main instructions
├── resources/         # Optional: reference materials
│   └── checklist.md
└── scripts/           # Optional: automation scripts
    └── validate.sh
```

## Next Steps

1. Copy this directory: `cp -r example-skill my-new-skill`
2. Edit `my-new-skill/SKILL.md` with your content
3. Deploy with: `skillsmgr add my-new-skill`
```

**Step 2: Commit**

```bash
git add src/templates/example-skill/SKILL.md
git commit -m "feat: add example skill template"
```

---

## Task 11: Setup Command

**Files:**
- Create: `src/commands/setup.ts`

**Step 1: Create src/commands/setup.ts**

```typescript
import { Command } from 'commander';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SKILLS_MANAGER_DIR, SKILL_SOURCES } from '../constants.js';
import { ensureDir, copyDir, fileExists } from '../utils/fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function executeSetup(): Promise<void> {
  console.log(`Creating ${SKILLS_MANAGER_DIR}...`);

  // Create source directories
  for (const source of SKILL_SOURCES) {
    const dir = join(SKILLS_MANAGER_DIR, source);
    ensureDir(dir);
    console.log(`✓ Created ${source}/`);
  }

  // Copy example skill template
  const templateDir = join(__dirname, '..', 'templates', 'example-skill');
  const targetDir = join(SKILLS_MANAGER_DIR, 'custom', 'example-skill');

  if (!fileExists(targetDir)) {
    copyDir(templateDir, targetDir);
    console.log('✓ Created custom/example-skill/SKILL.md');
  } else {
    console.log('· custom/example-skill already exists, skipping');
  }

  console.log('\nSetup complete!\n');
  console.log('Next steps:');
  console.log('  skillsmgr install anthropic    # Download official Anthropic skills');
  console.log('  skillsmgr list                 # View available skills');
  console.log('  skillsmgr init                 # Deploy skills to your project');
}

export const setupCommand = new Command('setup')
  .description('Initialize ~/.skills-manager/ directory structure')
  .action(async () => {
    await executeSetup();
  });
```

**Step 2: Commit**

```bash
git add src/commands/setup.ts
git commit -m "feat: add setup command"
```

---

## Task 12: List Command

**Files:**
- Create: `src/commands/list.ts`

**Step 1: Create src/commands/list.ts**

```typescript
import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { MetadataService } from '../services/metadata.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ListOptions, ToolName } from '../types.js';
import { fileExists } from '../utils/fs.js';

export async function executeList(options: ListOptions): Promise<void> {
  if (options.deployed) {
    await listDeployed();
  } else {
    await listAvailable();
  }
}

async function listAvailable(): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const service = new SkillsService(SKILLS_MANAGER_DIR);
  const skills = service.getAllSkills();

  if (skills.length === 0) {
    console.log('No skills found in ~/.skills-manager/');
    console.log('\nRun: skillsmgr install anthropic');
    return;
  }

  console.log('Available skills in ~/.skills-manager/:\n');

  // Group by source
  const grouped: Record<string, typeof skills> = {};
  for (const skill of skills) {
    if (!grouped[skill.source]) {
      grouped[skill.source] = [];
    }
    grouped[skill.source].push(skill);
  }

  for (const [source, sourceSkills] of Object.entries(grouped)) {
    console.log(`── ${source} (${sourceSkills.length} skill${sourceSkills.length > 1 ? 's' : ''}) ──`);
    for (const skill of sourceSkills) {
      console.log(`  ${skill.name.padEnd(20)} ${skill.description}`);
    }
    console.log();
  }
}

async function listDeployed(): Promise<void> {
  const metadataService = new MetadataService(process.cwd());

  if (!metadataService.hasMetadata()) {
    console.log('No skills deployed in current project.');
    console.log('\nRun: skillsmgr init');
    return;
  }

  console.log('Deployed skills in current project:\n');

  const configuredTools = metadataService.getConfiguredTools();

  for (const toolName of configuredTools) {
    const deployment = metadataService.getToolDeployment(toolName);
    if (!deployment) continue;

    const config = TOOL_CONFIGS[toolName as ToolName];
    const displayName = config?.displayName || toolName;

    console.log(`${displayName} (${deployment.targetDir}/):`);

    for (const skill of deployment.skills) {
      const modeStr = skill.deployMode === 'link' ? 'link' : 'copy';
      console.log(`  ◉ ${skill.name.padEnd(16)} (${modeStr}) ← ${skill.source}`);
    }
    console.log();
  }
}

export const listCommand = new Command('list')
  .description('List available or deployed skills')
  .option('--deployed', 'List deployed skills in current project')
  .action(async (options: ListOptions) => {
    await executeList(options);
  });
```

**Step 2: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: add list command"
```

---

## Task 13: Install Command

**Files:**
- Create: `src/commands/install.ts`

**Step 1: Create src/commands/install.ts**

```typescript
import { Command } from 'commander';
import { join } from 'path';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { GitService } from '../services/git.js';
import { SkillsService } from '../services/skills.js';
import { InstallOptions } from '../types.js';
import { fileExists, getDirectoriesInDir } from '../utils/fs.js';
import { promptSkillsToInstall } from '../utils/prompts.js';

export async function executeInstall(
  source: string,
  options: InstallOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const gitService = new GitService();

  // Check if this is a specific skill URL
  if (gitService.isSpecificSkillUrl(source)) {
    const skillPath = gitService.cloneSpecificSkill(source, options.custom || false);
    if (skillPath) {
      console.log(`✓ Installed skill to ${skillPath}`);
    } else {
      console.log('Failed to parse skill URL');
      process.exit(1);
    }
    return;
  }

  // Clone the repository
  const repoPath = gitService.clone(source, options.custom || false);

  // Find all skills in the repo
  const skillDirs = getDirectoriesInDir(repoPath);
  const skills: Array<{ name: string; description: string; path: string }> = [];

  for (const dir of skillDirs) {
    const skillMdPath = join(dir.path, 'SKILL.md');
    if (fileExists(skillMdPath)) {
      // Parse SKILL.md for description
      const service = new SkillsService(SKILLS_MANAGER_DIR);
      const allSkills = service.getAllSkills();
      const skill = allSkills.find((s) => s.path === dir.path);
      skills.push({
        name: dir.name,
        description: skill?.description || '',
        path: dir.path,
      });
    }
  }

  if (skills.length === 0) {
    console.log('No skills found in repository');
    return;
  }

  console.log(`Found ${skills.length} skills.\n`);

  // If --all flag, install all
  if (options.all) {
    console.log(`✓ Installed ${skills.length} skills to ${repoPath}`);
    return;
  }

  // Otherwise, prompt for selection
  const selectedNames = await promptSkillsToInstall(skills);

  if (selectedNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  // For skills not selected, we could remove them, but for simplicity
  // we just report what was installed
  console.log(`\n✓ Installed ${selectedNames.length} skills to ${repoPath}`);
}

export const installCommand = new Command('install')
  .description('Download skills from a repository')
  .argument('<source>', 'Repository URL or "anthropic" for official skills')
  .option('--all', 'Install all skills without prompting')
  .option('--custom', 'Install to custom/ instead of community/')
  .action(async (source: string, options: InstallOptions) => {
    await executeInstall(source, options);
  });
```

**Step 2: Commit**

```bash
git add src/commands/install.ts
git commit -m "feat: add install command"
```

---

## Task 14: Init Command

**Files:**
- Create: `src/commands/init.ts`

**Step 1: Create src/commands/init.ts**

```typescript
import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS, getTargetDir } from '../tools/configs.js';
import { InitOptions, ToolName, DeployedSkill } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptTools, promptMode, promptSkills } from '../utils/prompts.js';

export async function executeInit(options: InitOptions): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  const allSkills = skillsService.getAllSkills();

  if (allSkills.length === 0) {
    console.log('No skills found. Run: skillsmgr install anthropic');
    process.exit(1);
  }

  // Get configured tools for marking in prompt
  const configuredTools = metadataService.getConfiguredTools();

  // Prompt for tools
  const selectedTools = await promptTools(configuredTools);

  // For each tool, handle mode-specific if needed
  const toolModes: Record<string, string> = {};
  for (const toolName of selectedTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    if (config.supportsModeSpecific && config.availableModes) {
      const mode = await promptMode(toolName, config.availableModes);
      toolModes[toolName] = mode;
    } else {
      toolModes[toolName] = 'all';
    }
  }

  // Get currently deployed skills for each tool
  const deployedSkillNames = new Set<string>();
  for (const toolName of selectedTools) {
    const deployed = metadataService.getDeployedSkills(toolName);
    deployed.forEach((s) => deployedSkillNames.add(s.name));
  }

  // Prompt for skills
  const selectedSkillNames = await promptSkills(
    allSkills,
    Array.from(deployedSkillNames)
  );

  if (selectedSkillNames.length === 0) {
    console.log('No skills selected');
    return;
  }

  const selectedSkills = skillsService.getSkillsByNames(selectedSkillNames);
  const deployMode = options.copy ? 'copy' : 'link';

  console.log('\nDeploying skills...\n');

  // Deploy to each tool
  for (const toolName of selectedTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const mode = toolModes[toolName];
    const targetDir = getTargetDir(config, mode);

    console.log(`${config.displayName}:`);

    // Get previously deployed skills
    const previouslyDeployed = metadataService.getDeployedSkills(toolName);
    const previousNames = new Set(previouslyDeployed.map((s) => s.name));

    // Determine changes
    const toAdd = selectedSkills.filter((s) => !previousNames.has(s.name));
    const toKeep = selectedSkills.filter((s) => previousNames.has(s.name));
    const toRemove = previouslyDeployed.filter(
      (s) => !selectedSkillNames.includes(s.name)
    );

    // Remove skills no longer selected
    for (const skill of toRemove) {
      deployer.removeSkill(skill.name, config, mode);
      console.log(`  ✗ ${skill.name} (removed)`);
    }

    // Keep unchanged skills
    for (const skill of toKeep) {
      console.log(`  · ${skill.name} (unchanged)`);
    }

    // Add new skills
    for (const skill of toAdd) {
      deployer.deploySkill(skill, config, deployMode, mode);
      console.log(`  ✓ ${skill.name} (${deployMode === 'link' ? 'linked' : 'copied'})`);
    }

    // Update metadata
    const newDeployedSkills: DeployedSkill[] = selectedSkills.map((skill) => ({
      name: skill.name,
      source: skill.source,
      deployMode,
    }));

    metadataService.addDeployment(toolName, targetDir, mode, newDeployedSkills);

    console.log();
  }

  const totalAdded = selectedTools.reduce((sum, toolName) => {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const mode = toolModes[toolName];
    const previouslyDeployed = metadataService.getDeployedSkills(toolName);
    const previousNames = new Set(previouslyDeployed.map((s) => s.name));
    return sum + selectedSkills.filter((s) => !previousNames.has(s.name)).length;
  }, 0);

  console.log(
    `Done! Deployed ${selectedSkillNames.length} skills to ${selectedTools.length} tool${selectedTools.length > 1 ? 's' : ''}.`
  );
}

export const initCommand = new Command('init')
  .description('Deploy skills to current project')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (options: InitOptions) => {
    await executeInit(options);
  });
```

**Step 2: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: add init command for interactive deployment"
```

---

## Task 15: Add Command

**Files:**
- Create: `src/commands/add.ts`

**Step 1: Create src/commands/add.ts**

```typescript
import { Command } from 'commander';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { AddOptions, ToolName, DeployedSkill } from '../types.js';
import { fileExists } from '../utils/fs.js';
import { promptSelect } from '../utils/prompts.js';

export async function executeAdd(
  skillName: string,
  options: AddOptions
): Promise<void> {
  if (!fileExists(SKILLS_MANAGER_DIR)) {
    console.log('Skills manager not set up. Run: skillsmgr setup');
    process.exit(1);
  }

  const skillsService = new SkillsService(SKILLS_MANAGER_DIR);
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  // Find skill(s) by name
  const matchingSkills = skillsService.findSkillsByName(skillName);

  if (matchingSkills.length === 0) {
    console.log(`Skill '${skillName}' not found`);
    process.exit(1);
  }

  // If multiple matches, prompt for selection
  let skill = matchingSkills[0];
  if (matchingSkills.length > 1) {
    console.log(`Multiple skills found with name '${skillName}':`);
    const choices = matchingSkills.map((s, i) => ({
      name: `${i + 1}. ${s.source}/${s.name}`,
      value: s.source,
    }));
    const selectedSource = await promptSelect('Select skill:', choices);
    skill = matchingSkills.find((s) => s.source === selectedSource)!;
  }

  // Determine target tools
  let targetTools: string[];
  if (options.tool) {
    if (!TOOL_CONFIGS[options.tool as ToolName]) {
      console.log(`Unknown tool: ${options.tool}`);
      process.exit(1);
    }
    targetTools = [options.tool];
  } else {
    // Use configured tools from metadata
    targetTools = metadataService.getConfiguredTools();
    if (targetTools.length === 0) {
      console.log('No tools configured. Run: skillsmgr init');
      process.exit(1);
    }
  }

  const deployMode = options.copy ? 'copy' : 'link';

  console.log(`Adding ${skillName} to configured tools...`);

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    const mode = deployment?.mode || 'all';

    deployer.deploySkill(skill, config, deployMode, mode);

    // Update metadata
    const existingSkills = metadataService.getDeployedSkills(toolName);
    const alreadyExists = existingSkills.some((s) => s.name === skill.name);

    if (!alreadyExists) {
      const newSkill: DeployedSkill = {
        name: skill.name,
        source: skill.source,
        deployMode,
      };
      metadataService.updateDeployment(toolName, [...existingSkills, newSkill]);
    }

    console.log(
      `  ✓ ${config.displayName} (${deployMode === 'link' ? 'linked' : 'copied'})`
    );
  }
}

export const addCommand = new Command('add')
  .description('Add a skill to the project')
  .argument('<skill>', 'Skill name to add')
  .option('--tool <tool>', 'Add to specific tool only')
  .option('--copy', 'Copy files instead of creating symlinks')
  .action(async (skill: string, options: AddOptions) => {
    await executeAdd(skill, options);
  });
```

**Step 2: Commit**

```bash
git add src/commands/add.ts
git commit -m "feat: add add command for quick skill deployment"
```

---

## Task 16: Remove Command

**Files:**
- Create: `src/commands/remove.ts`

**Step 1: Create src/commands/remove.ts**

```typescript
import { Command } from 'commander';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { RemoveOptions, ToolName } from '../types.js';

export async function executeRemove(
  skillName: string,
  options: RemoveOptions
): Promise<void> {
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  if (!metadataService.hasMetadata()) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  // Determine target tools
  let targetTools: string[];
  if (options.tool) {
    if (!TOOL_CONFIGS[options.tool as ToolName]) {
      console.log(`Unknown tool: ${options.tool}`);
      process.exit(1);
    }
    targetTools = [options.tool];
  } else {
    targetTools = metadataService.getConfiguredTools();
  }

  console.log(`Removing ${skillName}...`);

  let removed = false;

  for (const toolName of targetTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    if (!deployment) continue;

    const existingSkills = deployment.skills;
    const skillToRemove = existingSkills.find((s) => s.name === skillName);

    if (!skillToRemove) continue;

    deployer.removeSkill(skillName, config, deployment.mode);

    // Update metadata
    const remainingSkills = existingSkills.filter((s) => s.name !== skillName);
    metadataService.updateDeployment(toolName, remainingSkills);

    console.log(`  ✓ Removed from ${config.displayName}`);
    removed = true;
  }

  if (!removed) {
    console.log(`Skill '${skillName}' not found in any configured tool`);
  }
}

export const removeCommand = new Command('remove')
  .description('Remove a skill from the project')
  .argument('<skill>', 'Skill name to remove')
  .option('--tool <tool>', 'Remove from specific tool only')
  .action(async (skill: string, options: RemoveOptions) => {
    await executeRemove(skill, options);
  });
```

**Step 2: Commit**

```bash
git add src/commands/remove.ts
git commit -m "feat: add remove command"
```

---

## Task 17: Sync Command

**Files:**
- Create: `src/commands/sync.ts`

**Step 1: Create src/commands/sync.ts**

```typescript
import { Command } from 'commander';
import { join } from 'path';
import { readFileSync } from 'fs';
import { SKILLS_MANAGER_DIR } from '../constants.js';
import { MetadataService } from '../services/metadata.js';
import { Deployer } from '../services/deployer.js';
import { TOOL_CONFIGS } from '../tools/configs.js';
import { ToolName } from '../types.js';
import { fileExists, isSymlink, readFileContent } from '../utils/fs.js';
import { promptSyncAction, promptOrphanAction } from '../utils/prompts.js';

export async function executeSync(): Promise<void> {
  const metadataService = new MetadataService(process.cwd());
  const deployer = new Deployer(process.cwd());

  if (!metadataService.hasMetadata()) {
    console.log('No skills deployed in current project.');
    process.exit(1);
  }

  console.log('Checking deployed skills...\n');

  const configuredTools = metadataService.getConfiguredTools();
  let updatedCount = 0;
  let removedCount = 0;
  let untrackedCount = 0;

  for (const toolName of configuredTools) {
    const config = TOOL_CONFIGS[toolName as ToolName];
    const deployment = metadataService.getToolDeployment(toolName);
    if (!deployment) continue;

    console.log(`${config.displayName} (${deployment.targetDir}/):`);

    for (const skill of deployment.skills) {
      const deployedPath = join(process.cwd(), deployment.targetDir, skill.name);
      const sourcePath = join(SKILLS_MANAGER_DIR, skill.source, skill.name);

      // Check if source still exists
      if (!fileExists(sourcePath)) {
        console.log(`  ✗ ${skill.name}: orphaned (source deleted)`);
        const action = await promptOrphanAction(skill.name);
        if (action === 'remove') {
          deployer.removeSkill(skill.name, config, deployment.mode);
          const remaining = deployment.skills.filter((s) => s.name !== skill.name);
          metadataService.updateDeployment(toolName, remaining);
          console.log(`  ✓ Removed ${skill.name}`);
          removedCount++;
        }
        continue;
      }

      // Check symlink status
      if (isSymlink(deployedPath)) {
        console.log(`  ✓ ${skill.name}: up to date (link)`);
        continue;
      }

      // For copied files, check if content changed
      if (skill.deployMode === 'copy') {
        const sourceSkillMd = join(sourcePath, 'SKILL.md');
        const deployedSkillMd = join(deployedPath, 'SKILL.md');

        if (fileExists(sourceSkillMd) && fileExists(deployedSkillMd)) {
          const sourceContent = readFileContent(sourceSkillMd);
          const deployedContent = readFileContent(deployedSkillMd);

          if (sourceContent !== deployedContent) {
            console.log(`  ⚠ ${skill.name}: source changed (copy)`);
            const action = await promptSyncAction(skill.name);

            if (action === 'diff') {
              console.log('\n--- local');
              console.log(deployedContent.slice(0, 500));
              console.log('\n+++ source');
              console.log(sourceContent.slice(0, 500));
              console.log();

              const finalAction = await promptSyncAction(skill.name);
              if (finalAction === 'overwrite') {
                deployer.deploySkill(
                  { name: skill.name, description: '', path: sourcePath, source: skill.source },
                  config,
                  'copy',
                  deployment.mode
                );
                console.log(`  ✓ Updated ${skill.name}`);
                updatedCount++;
              }
            } else if (action === 'overwrite') {
              deployer.deploySkill(
                { name: skill.name, description: '', path: sourcePath, source: skill.source },
                config,
                'copy',
                deployment.mode
              );
              console.log(`  ✓ Updated ${skill.name}`);
              updatedCount++;
            }
          } else {
            console.log(`  ✓ ${skill.name}: up to date (copy)`);
          }
        }
      }
    }

    console.log();
  }

  console.log(
    `Sync complete: ${updatedCount} updated, ${removedCount} removed, ${untrackedCount} untracked`
  );
}

export const syncCommand = new Command('sync')
  .description('Sync and verify deployed skills')
  .action(async () => {
    await executeSync();
  });
```

**Step 2: Commit**

```bash
git add src/commands/sync.ts
git commit -m "feat: add sync command for verification and updates"
```

---

## Task 18: CLI Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Create src/index.ts**

```typescript
import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { syncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('skillsmgr')
  .description('Unified skills manager for AI coding tools')
  .version('0.1.0');

program.addCommand(setupCommand);
program.addCommand(installCommand);
program.addCommand(listCommand);
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(removeCommand);
program.addCommand(syncCommand);

program.parse();
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with all commands"
```

---

## Task 19: Build and Test CLI

**Step 1: Build the project**

Run: `npm run build`
Expected: Successful build, dist/ directory created

**Step 2: Test setup command**

Run: `node dist/index.js setup`
Expected: Creates ~/.skills-manager/ with subdirectories

**Step 3: Test list command**

Run: `node dist/index.js list`
Expected: Shows available skills

**Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and runtime issues"
```

---

## Task 20: Final Integration Test

**Step 1: Full workflow test**

```bash
# Setup
node dist/index.js setup

# Install official skills (if available)
node dist/index.js install anthropic --all

# List skills
node dist/index.js list

# Create test project
mkdir /tmp/test-project && cd /tmp/test-project

# Init with skills
node ~/path/to/skills-manager/dist/index.js init

# List deployed
node ~/path/to/skills-manager/dist/index.js list --deployed

# Add a skill
node ~/path/to/skills-manager/dist/index.js add example-skill

# Remove a skill
node ~/path/to/skills-manager/dist/index.js remove example-skill

# Sync
node ~/path/to/skills-manager/dist/index.js sync
```

**Step 2: Final commit**

```bash
git add -A
git commit -m "chore: complete implementation"
```

---

## Summary

Total tasks: 20
Estimated commits: ~20

Key files created:
- `src/index.ts` - CLI entry point
- `src/constants.ts` - Constants and config values
- `src/types.ts` - TypeScript interfaces
- `src/tools/configs.ts` - Tool configurations
- `src/utils/fs.ts` - File system utilities
- `src/utils/prompts.ts` - Interactive prompts
- `src/services/skills.ts` - Skills management
- `src/services/deployer.ts` - Deployment logic
- `src/services/metadata.ts` - Metadata tracking
- `src/services/git.ts` - Git operations
- `src/commands/*.ts` - CLI commands (7 files)
- `src/templates/example-skill/SKILL.md` - Example template

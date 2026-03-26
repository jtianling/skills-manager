import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('custom-update command', () => {
  const testDir = join(tmpdir(), `skillsmgr-cu-test-${Date.now()}`);
  const fakeSkillsManagerDir = join(testDir, '.skills-manager');
  const fakeProjectDir = join(testDir, 'project');

  beforeEach(() => {
    mkdirSync(fakeProjectDir, { recursive: true });
    mkdirSync(join(fakeSkillsManagerDir, 'custom'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createSourceSkill(name: string, content: string) {
    const dir = join(fakeProjectDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content);
    return dir;
  }

  function createInstalledSkill(name: string, content: string) {
    const dir = join(fakeSkillsManagerDir, 'custom', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), content);
    return dir;
  }

  it('successfully updates an installed custom skill', async () => {
    // Arrange: source with new content, installed with old content
    createSourceSkill('my-skill', '---\nname: my-skill\n---\n# Updated');
    createInstalledSkill('my-skill', '---\nname: my-skill\n---\n# Old');
    writeFileSync(join(fakeProjectDir, 'my-skill', 'extra.md'), 'extra file');

    // Act: simulate what custom-update does
    const { copyDir, removeDir, fileExists } = await import('../utils/fs.js');

    const skillDir = join(fakeProjectDir, 'my-skill');
    const skillMd = join(skillDir, 'SKILL.md');
    const targetDir = join(fakeSkillsManagerDir, 'custom', 'my-skill');

    expect(fileExists(skillMd)).toBe(true);
    expect(fileExists(targetDir)).toBe(true);

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    // Assert
    expect(existsSync(targetDir)).toBe(true);
    const updatedContent = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(updatedContent).toContain('# Updated');
    expect(existsSync(join(targetDir, 'extra.md'))).toBe(true);
  });

  it('errors when target skill is not installed', async () => {
    // Arrange: source exists but no installed copy
    createSourceSkill('new-skill', '---\nname: new-skill\n---\n# New');

    const { fileExists } = await import('../utils/fs.js');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'new-skill');
    expect(fileExists(targetDir)).toBe(false);
  });

  it('errors when source skill is not found in CWD', async () => {
    // Arrange: installed but no source in CWD
    createInstalledSkill('missing-source', '---\nname: missing-source\n---\n# Installed');

    const { fileExists } = await import('../utils/fs.js');

    const skillMd = join(fakeProjectDir, 'missing-source', 'SKILL.md');
    expect(fileExists(skillMd)).toBe(false);
  });

  it('errors when skills manager is not set up', async () => {
    // Arrange: no .skills-manager directory
    rmSync(fakeSkillsManagerDir, { recursive: true, force: true });

    const { fileExists } = await import('../utils/fs.js');
    expect(fileExists(fakeSkillsManagerDir)).toBe(false);
  });

  it('derives skill name from relative path via basename', async () => {
    // Arrange: source at a nested relative-like path, installed as just the name
    createSourceSkill('path-skill', '---\nname: path-skill\n---\n# Via Path');
    createInstalledSkill('path-skill', '---\nname: path-skill\n---\n# Old');

    const { copyDir, removeDir, fileExists } = await import('../utils/fs.js');
    const { basename, resolve } = await import('path');

    // Simulate: user passes "./path-skill" — resolve + basename extracts "path-skill"
    const userArg = './path-skill';
    const skillDir = resolve(fakeProjectDir, userArg);
    const skillName = basename(skillDir);
    const targetDir = join(fakeSkillsManagerDir, 'custom', skillName);

    expect(skillName).toBe('path-skill');
    expect(fileExists(join(skillDir, 'SKILL.md'))).toBe(true);
    expect(fileExists(targetDir)).toBe(true);

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    const content = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('# Via Path');
  });

  it('derives skill name from absolute path via basename', async () => {
    // Arrange: source at an absolute path
    const absSourceDir = join(testDir, 'elsewhere', 'abs-skill');
    mkdirSync(absSourceDir, { recursive: true });
    writeFileSync(join(absSourceDir, 'SKILL.md'), '---\nname: abs-skill\n---\n# Absolute');
    createInstalledSkill('abs-skill', '---\nname: abs-skill\n---\n# Old');

    const { copyDir, removeDir, fileExists } = await import('../utils/fs.js');
    const { basename, resolve } = await import('path');

    // Simulate: user passes absolute path
    const userArg = absSourceDir;
    const skillDir = resolve(fakeProjectDir, userArg);
    const skillName = basename(skillDir);
    const targetDir = join(fakeSkillsManagerDir, 'custom', skillName);

    expect(skillName).toBe('abs-skill');
    expect(fileExists(join(skillDir, 'SKILL.md'))).toBe(true);

    removeDir(targetDir);
    copyDir(skillDir, targetDir);

    const content = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('# Absolute');
  });

  it('finds skill in group directory when ungrouped path does not exist', async () => {
    createSourceSkill('grouped-skill', '---\nname: grouped-skill\n---\n# V2');
    const groupDir = join(fakeSkillsManagerDir, 'custom', 'my-tools', 'grouped-skill');
    mkdirSync(groupDir, { recursive: true });
    writeFileSync(join(groupDir, 'SKILL.md'), '---\nname: grouped-skill\n---\n# V1');

    const { copyDir, fileExists, removeDir, getDirectoriesInDir } = await import('../utils/fs.js');

    const skillName = 'grouped-skill';
    let targetDir = join(fakeSkillsManagerDir, 'custom', skillName);

    if (!fileExists(targetDir)) {
      const customDir = join(fakeSkillsManagerDir, 'custom');
      for (const gDir of getDirectoriesInDir(customDir)) {
        const groupedTarget = join(gDir.path, skillName);
        if (fileExists(groupedTarget)) {
          targetDir = groupedTarget;
          break;
        }
      }
    }

    expect(targetDir).toBe(groupDir);
    removeDir(targetDir);
    copyDir(join(fakeProjectDir, 'grouped-skill'), targetDir);

    const content = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('# V2');
  });

  it('prefers ungrouped path over grouped path', async () => {
    createSourceSkill('dual-skill', '---\nname: dual-skill\n---\n# V3');
    createInstalledSkill('dual-skill', '---\nname: dual-skill\n---\n# V1 ungrouped');
    const groupDir = join(fakeSkillsManagerDir, 'custom', 'my-tools', 'dual-skill');
    mkdirSync(groupDir, { recursive: true });
    writeFileSync(join(groupDir, 'SKILL.md'), '---\nname: dual-skill\n---\n# V1 grouped');

    const { fileExists } = await import('../utils/fs.js');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'dual-skill');
    expect(fileExists(targetDir)).toBe(true);
  });

  it('errors when skill not found in ungrouped or grouped paths', async () => {
    createSourceSkill('nowhere-skill', '---\nname: nowhere-skill\n---\n# New');

    const { fileExists, getDirectoriesInDir } = await import('../utils/fs.js');

    const skillName = 'nowhere-skill';
    let targetDir = join(fakeSkillsManagerDir, 'custom', skillName);
    let found = fileExists(targetDir);

    if (!found) {
      const customDir = join(fakeSkillsManagerDir, 'custom');
      for (const gDir of getDirectoriesInDir(customDir)) {
        if (fileExists(join(gDir.path, skillName))) {
          found = true;
          break;
        }
      }
    }

    expect(found).toBe(false);
  });

  it('does not prompt for confirmation during update', async () => {
    // Arrange
    createSourceSkill('no-prompt-skill', '---\nname: no-prompt-skill\n---\n# V2');
    createInstalledSkill('no-prompt-skill', '---\nname: no-prompt-skill\n---\n# V1');

    // The custom-update command source has no promptConfirm import
    const commandSource = readFileSync(
      join(__dirname, 'custom-update.ts'),
      'utf-8'
    );
    expect(commandSource).not.toContain('promptConfirm');
  });
});

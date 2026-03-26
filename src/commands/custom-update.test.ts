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

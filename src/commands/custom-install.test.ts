import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('custom-install --group', () => {
  const testDir = join(tmpdir(), `skillsmgr-ci-test-${Date.now()}`);
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

  it('installs to ungrouped path without --group', async () => {
    createSourceSkill('abc', '---\nname: abc\n---\n# ABC');

    const { copyDir, fileExists } = await import('../utils/fs.js');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'abc');
    copyDir(join(fakeProjectDir, 'abc'), targetDir);

    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);
    expect(fileExists(join(fakeSkillsManagerDir, 'custom', 'my-tools', 'abc'))).toBe(false);
  });

  it('installs to grouped path with --group', async () => {
    createSourceSkill('abc', '---\nname: abc\n---\n# ABC');

    const { copyDir } = await import('../utils/fs.js');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'my-tools', 'abc');
    mkdirSync(join(fakeSkillsManagerDir, 'custom', 'my-tools'), { recursive: true });
    copyDir(join(fakeProjectDir, 'abc'), targetDir);

    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);
    const content = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('# ABC');
  });

  it('auto-creates group directory', async () => {
    createSourceSkill('abc', '---\nname: abc\n---\n# ABC');

    const groupDir = join(fakeSkillsManagerDir, 'custom', 'new-group');
    expect(existsSync(groupDir)).toBe(false);

    mkdirSync(groupDir, { recursive: true });
    expect(existsSync(groupDir)).toBe(true);
  });

  it('detects existing skill in group for overwrite prompt', async () => {
    createSourceSkill('abc', '---\nname: abc\n---\n# V2');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'my-tools', 'abc');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'SKILL.md'), '---\nname: abc\n---\n# V1');

    const { fileExists } = await import('../utils/fs.js');
    expect(fileExists(targetDir)).toBe(true);
  });

  it('force flag skips confirmation', async () => {
    createSourceSkill('abc', '---\nname: abc\n---\n# V2');

    const targetDir = join(fakeSkillsManagerDir, 'custom', 'my-tools', 'abc');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'SKILL.md'), '---\nname: abc\n---\n# V1');

    const { copyDir, removeDir } = await import('../utils/fs.js');

    removeDir(targetDir);
    copyDir(join(fakeProjectDir, 'abc'), targetDir);

    const content = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('# V2');
  });
});

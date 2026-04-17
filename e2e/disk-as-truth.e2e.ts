import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('disk-as-truth for local skills E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createLocalSkill(name: string, dir?: string, body = 'A test skill.'): string {
    const skillDir = join(dir ?? env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${name} description\n---\n# ${name}\n${body}\n`,
    );
    return skillDir;
  }

  function readSources(): Record<string, unknown> {
    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    if (!existsSync(sourcesPath)) {
      return { sources: {} };
    }
    return JSON.parse(readFileSync(sourcesPath, 'utf-8'));
  }

  function seedDiskOnlySkill(name: string, body = 'legacy content'): string {
    const installedDir = join(env.homeDir, '.skills-manager', 'custom', name);
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(
      join(installedDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: legacy ${name}\n---\n# ${name}\n${body}\n`,
    );
    return installedDir;
  }

  it('disk has skill with no sources entry: install says exists, update ./path succeeds, uninstall removes it', async () => {
    const seededDir = seedDiskOnlySkill('orphan-skill');
    expect(existsSync(join(seededDir, 'SKILL.md'))).toBe(true);
    expect(Object.keys((readSources() as { sources: Record<string, unknown> }).sources ?? {})).not.toContain('custom/orphan-skill');

    const newSourceDir = createLocalSkill('orphan-skill', env.projectDir, 'updated content');
    expect(existsSync(join(newSourceDir, 'SKILL.md'))).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./orphan-skill', env.projectDir);
    const installOutput = await tmux.waitForText(/already exists\. Overwrite/i, 15_000);
    expect(installOutput).toMatch(/already exists/i);
    await tmux.sendKeys('n');
    await tmux.pressEnter();
    await tmux.waitForText(/Cancelled|Installed|already/i, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update ./orphan-skill', env.projectDir);
    const updateOutput = await tmux.waitForText(/updated|up to date/i, 20_000);
    expect(updateOutput).not.toMatch(/No installed skill found/i);
    expect(updateOutput).toMatch(/orphan-skill/);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall orphan-skill --force', env.projectDir);
    await tmux.waitForText(/Uninstalled|removed|deleted|complete/i, 20_000);
    tmux.destroy();

    expect(existsSync(seededDir)).toBe(false);
  });

  it('install ./path twice from different source directories: second run shows overwrite prompt, not URL-mismatch error', async () => {
    const pathA = join(env.projectDir, 'path-a');
    const pathB = join(env.projectDir, 'path-b');
    mkdirSync(pathA, { recursive: true });
    mkdirSync(pathB, { recursive: true });

    createLocalSkill('dup-skill', pathA, 'from A');
    createLocalSkill('dup-skill', pathB, 'from B');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dup-skill', pathA);
    await tmux.waitForText(/Installed|installed/i, 15_000);
    tmux.destroy();

    const targetDir = join(env.homeDir, '.skills-manager', 'custom', 'dup-skill');
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./dup-skill', pathB);
    const output = await tmux.waitForText(/already exists\. Overwrite/i, 15_000);
    expect(output).toMatch(/already exists/i);
    expect(output).not.toMatch(/is already installed from/i);
    expect(output).not.toMatch(/To move it to/i);
    await tmux.sendKeys('y');
    await tmux.pressEnter();
    await tmux.waitForText(/Installed|installed/i, 15_000);
    tmux.destroy();

    const installedSkill = readFileSync(join(targetDir, 'SKILL.md'), 'utf-8');
    expect(installedSkill).toContain('from B');
  });

  it('bare skillsmgr update skips local skills and prints the skipped summary line', async () => {
    seedDiskOnlySkill('skip-a');
    seedDiskOnlySkill('skip-b');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr update', env.projectDir);
    const output = await tmux.waitForText(
      /local skill\(s\) skipped\. Use `skillsmgr update \.\/path`/,
      30_000,
    );
    expect(output).toMatch(/2 local skill\(s\) skipped/);
    expect(output).not.toMatch(/skip-a: updated/);
    expect(output).not.toMatch(/skip-b: updated/);
  });

  it('install ./path never writes a local-copy entry to sources.json', async () => {
    createLocalSkill('no-sources-entry');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install ./no-sources-entry', env.projectDir);
    await tmux.waitForText(/Installed|installed/i, 15_000);
    tmux.destroy();

    const sources = readSources() as { sources?: Record<string, { installMethod?: string }> };
    const entry = sources.sources?.['custom/no-sources-entry'];
    expect(entry).toBeUndefined();

    const installedDir = join(env.homeDir, '.skills-manager', 'custom', 'no-sources-entry');
    expect(existsSync(join(installedDir, 'SKILL.md'))).toBe(true);
  });
});

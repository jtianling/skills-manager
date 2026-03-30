import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getInstalledSkillNames } from './helpers/skills.js';

describe('install E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('install anthropics/skills --all discovers 15+ skills and classifies as official', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);

    const pane = await tmux.capturePane();
    const foundMatch = pane.match(/Found (\d+) skills?\./);
    expect(foundMatch).not.toBeNull();
    expect(Number(foundMatch![1])).toBeGreaterThanOrEqual(15);

    const officialDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    expect(existsSync(officialDir)).toBe(true);

    const installed = getInstalledSkillNames(officialDir);
    expect(installed.length).toBeGreaterThanOrEqual(15);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    const sourceKey = Object.keys(sources.sources).find((k: string) => k.includes('anthropic'));
    expect(sourceKey).toBeDefined();
    expect(sourceKey).toMatch(/^official\//);
    expect(sources.sources[sourceKey!].type).toBe('official');
  });

  it('install anthropics/skills with interactive selection', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills');

    await tmux.waitForText('Select skills to install', 90_000);

    // Wait for UI to render fully
    await new Promise((r) => setTimeout(r, 500));

    // Select first skill and confirm
    await tmux.pressSpace();
    await new Promise((r) => setTimeout(r, 500));
    await tmux.pressEnter();

    await tmux.waitForText('Installed', 110_000);

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    expect(existsSync(skillsDir)).toBe(true);

    // Verify only the selected skill was installed (interactive selected 1)
    const installed = getInstalledSkillNames(skillsDir);
    expect(installed).toHaveLength(1);
  });

  it('install microsoft/skills --all discovers 160+ skills via marketplace manifest', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install microsoft/skills --all');
    await tmux.waitForText('Installed', 120_000);

    const pane = await tmux.capturePane();
    const foundMatch = pane.match(/Found (\d+) skills?\./);
    expect(foundMatch).not.toBeNull();
    expect(Number(foundMatch![1])).toBeGreaterThanOrEqual(160);

    const officialDir = join(env.homeDir, '.skills-manager', 'official', 'microsoft', 'skills');
    expect(existsSync(officialDir)).toBe(true);

    const installed = getInstalledSkillNames(officialDir);
    expect(installed.length).toBeGreaterThanOrEqual(160);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    const sourceKey = Object.keys(sources.sources).find((k: string) => k.includes('microsoft'));
    expect(sourceKey).toBeDefined();
    expect(sourceKey).toMatch(/^official\//);
    expect(sources.sources[sourceKey!].type).toBe('official');
  });

  it('install obra/superpowers --all discovers 10+ skills', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install obra/superpowers --all');
    await tmux.waitForText('Installed', 110_000);

    const pane = await tmux.capturePane();
    const foundMatch = pane.match(/Found (\d+) skills?\./);
    expect(foundMatch).not.toBeNull();
    expect(Number(foundMatch![1])).toBeGreaterThanOrEqual(10);

    const communityDir = join(env.homeDir, '.skills-manager', 'community', 'obra', 'superpowers');
    expect(existsSync(communityDir)).toBe(true);

    const installed = getInstalledSkillNames(communityDir);
    expect(installed.length).toBeGreaterThanOrEqual(10);
  });

  it('install mattpocock/skills --all discovers 15+ skills', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install mattpocock/skills --all');
    await tmux.waitForText('Installed', 110_000);

    const pane = await tmux.capturePane();
    const foundMatch = pane.match(/Found (\d+) skills?\./);
    expect(foundMatch).not.toBeNull();
    expect(Number(foundMatch![1])).toBeGreaterThanOrEqual(15);

    const communityDir = join(env.homeDir, '.skills-manager', 'community', 'mattpocock', 'skills');
    expect(existsSync(communityDir)).toBe(true);

    const installed = getInstalledSkillNames(communityDir);
    expect(installed.length).toBeGreaterThanOrEqual(15);
  });

  it('install mattpocock/skills pre-selects already installed skills', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    // Install only tdd and grill-me
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install mattpocock/skills -s tdd -s grill-me');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const communityDir = join(env.homeDir, '.skills-manager', 'community', 'mattpocock', 'skills');
    const installed = getInstalledSkillNames(communityDir);
    expect(installed.sort()).toEqual(['grill-me', 'tdd']);

    // Run interactive install again — tdd and grill-me should be pre-selected
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install mattpocock/skills');
    await tmux.waitForText('Select skills to install', 110_000);

    const pane = await tmux.capturePane();
    const lines = pane.split('\n');

    // tdd and grill-me should show (installed) suffix and filled circle ◉
    const tddLine = lines.find((l: string) => l.includes('tdd'));
    const grillLine = lines.find((l: string) => l.includes('grill-me'));
    expect(tddLine).toBeDefined();
    expect(tddLine).toContain('(installed)');
    expect(tddLine).toContain('◉');
    expect(grillLine).toBeDefined();
    expect(grillLine).toContain('(installed)');
    expect(grillLine).toContain('◉');

    // Non-installed skills visible on the page should have empty circle ◯
    const uncheckedLine = lines.find((l: string) => l.includes('◯'));
    expect(uncheckedLine).toBeDefined();
  });

  it('install GitHub tree URL for a specific skill path', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr setup');
    await tmux.waitForText('Setup complete');
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install anthropics/skills --all');
    await tmux.waitForText('Installed', 110_000);
    tmux.destroy();

    const skillsDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills');
    const installedSkills = getInstalledSkillNames(skillsDir);
    expect(installedSkills.length).toBeGreaterThan(0);
    const targetSkill = installedSkills[0];

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall anthropic -f');
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    const treeUrl = `https://github.com/anthropics/skills/tree/main/skills/${targetSkill}`;
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ${treeUrl}`);
    await tmux.waitForText(/Installed|installed/, 90_000);

    const targetDir = join(env.homeDir, '.skills-manager', 'official', 'anthropic', 'skills', targetSkill);
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(true);

    const sourcesPath = join(env.homeDir, '.skills-manager', 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    expect(Object.keys(sources.sources)).toContain('official/anthropic/skills');
    expect(sources.sources['official/anthropic/skills'].url).toBe('https://github.com/anthropics/skills');
  });
});

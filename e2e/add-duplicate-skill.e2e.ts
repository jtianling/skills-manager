import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames } from './helpers/skills.js';

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function createSkillMd(dir: string, name: string, description: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `${description}`,
    '',
  ].join('\n'));
}

function setupSkillsManager(homeDir: string): void {
  const smDir = join(homeDir, '.skills-manager');
  mkdirSync(join(smDir, 'official'), { recursive: true });
  mkdirSync(join(smDir, 'community'), { recursive: true });
  mkdirSync(join(smDir, 'custom'), { recursive: true });

  // Top-level: custom/test-skill
  createSkillMd(
    join(smDir, 'custom', 'test-skill'),
    'test-skill',
    'Top-level custom test skill',
  );

  // Nested: custom/my-group/test-skill
  createSkillMd(
    join(smDir, 'custom', 'my-group', 'test-skill'),
    'test-skill',
    'Nested custom test skill in my-group',
  );
}

describe('add duplicate skill E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
    setupSkillsManager(env.homeDir);
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  it('shows disambiguation prompt with distinct sources for same-name skills', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add test-skill -a claude-code', env.projectDir);

    await tmux.waitForText('Multiple skills found', 15_000);
    const pane = stripAnsi(await tmux.capturePane());

    expect(pane).toContain('custom/test-skill');
    expect(pane).toContain('custom/my-group/test-skill');
  });

  it('deploys selected skill from disambiguation prompt', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add test-skill -a claude-code', env.projectDir);

    await tmux.waitForText('Multiple skills found', 15_000);

    // Select the first option (top-level custom/test-skill)
    await tmux.pressEnter();
    await tmux.waitForText('linked', 15_000);

    const skillPath = join(env.projectDir, '.agents', 'skills', 'test-skill');
    expect(existsSync(skillPath)).toBe(true);
    expect(lstatSync(skillPath).isSymbolicLink()).toBe(true);

    // Verify only one skill deployed, not both
    expect(getDeployedSkillNames(join(env.projectDir, '.agents', 'skills'))).toEqual(['test-skill']);
  });

  it('can select the second option in disambiguation prompt', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr add test-skill -a claude-code', env.projectDir);

    await tmux.waitForText('Multiple skills found', 15_000);

    // Move down to select nested skill
    await tmux.sendKeys('Down');
    await tmux.pressEnter();
    await tmux.waitForText('linked', 15_000);

    const skillPath = join(env.projectDir, '.agents', 'skills', 'test-skill');
    expect(existsSync(skillPath)).toBe(true);
    expect(lstatSync(skillPath).isSymbolicLink()).toBe(true);
  });

  it('list shows both skills with different sources', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr list');

    await tmux.waitForText('custom', 15_000);
    const pane = stripAnsi(await tmux.capturePane());

    // Both should appear under custom section
    const testSkillLines = pane.split('\n').filter((l: string) => l.includes('test-skill'));
    expect(testSkillLines.length).toBeGreaterThanOrEqual(2);
  });
});

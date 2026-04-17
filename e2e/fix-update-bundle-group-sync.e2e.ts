import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('fix-update-bundle-group-sync E2E (local-batch update syncs new skills into same-name group)', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createSkillFile(parentDir: string, skillName: string, body = 'Initial content'): void {
    const skillDir = join(parentDir, skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${skillName}\ndescription: Test skill ${skillName}\n---\n# ${skillName}\n${body}\n`,
    );
  }

  function createSourceDir(dirName: string, skillNames: string[]): string {
    const dir = join(env.projectDir, dirName);
    mkdirSync(dir, { recursive: true });
    for (const name of skillNames) {
      createSkillFile(dir, name);
    }
    return dir;
  }

  function skillDeployedPath(groupName: string, skillName: string): string {
    return join(env.homeDir, '.skills-manager', 'custom', groupName, skillName, 'SKILL.md');
  }

  async function runAndWait(cmd: string, pattern: RegExp | string, timeout = 20_000): Promise<string> {
    tmux = new TmuxSession(env);
    await tmux.start(cmd, env.projectDir);
    const output = await tmux.waitForText(pattern, timeout);
    tmux.destroy();
    return output;
  }

  it('Scenario: 源目录新增 skill 被加入同名 group', async () => {
    const sourceDir = createSourceDir('tdd-spec', ['skill-a', 'skill-b']);

    await runAndWait(`skillsmgr install "${sourceDir}" --all`, /Installed|installed/);

    expect(existsSync(skillDeployedPath('tdd-spec', 'skill-a'))).toBe(true);
    expect(existsSync(skillDeployedPath('tdd-spec', 'skill-b'))).toBe(true);

    const preListing = await runAndWait('skillsmgr group list tdd-spec', /skill-a/);
    expect(preListing).toContain('skill-a');
    expect(preListing).toContain('skill-b');
    expect(preListing).not.toContain('skill-c');

    createSkillFile(sourceDir, 'skill-c');

    await runAndWait(`skillsmgr update "${sourceDir}"`, /Done!|updated|added/);

    expect(existsSync(skillDeployedPath('tdd-spec', 'skill-c'))).toBe(true);
    expect(existsSync(skillDeployedPath('tdd-spec', 'skill-a'))).toBe(true);
    expect(existsSync(skillDeployedPath('tdd-spec', 'skill-b'))).toBe(true);

    const postListing = await runAndWait('skillsmgr group list tdd-spec', /skill-c/);
    expect(postListing).toContain('skill-a');
    expect(postListing).toContain('skill-b');
    expect(postListing).toContain('skill-c');
  });

  it('Scenario: 多个新增 skill 同批加入同名 group', async () => {
    const sourceDir = createSourceDir('multi-add', ['base-1', 'base-2']);

    await runAndWait(`skillsmgr install "${sourceDir}" --all`, /Installed|installed/);

    createSkillFile(sourceDir, 'new-1');
    createSkillFile(sourceDir, 'new-2');
    createSkillFile(sourceDir, 'new-3');

    const updateOutput = await runAndWait(`skillsmgr update "${sourceDir}"`, /Done!|added/, 30_000);
    expect(updateOutput).toMatch(/3 added|added 3|\+ new-1|\+ new-2|\+ new-3/);

    for (const name of ['base-1', 'base-2', 'new-1', 'new-2', 'new-3']) {
      expect(existsSync(skillDeployedPath('multi-add', name))).toBe(true);
    }

    const listing = await runAndWait('skillsmgr group list multi-add', /new-3/);
    for (const name of ['base-1', 'base-2', 'new-1', 'new-2', 'new-3']) {
      expect(listing).toContain(name);
    }
  });

  it('Scenario: update 无变更时 group 保持不变 (幂等)', async () => {
    const sourceDir = createSourceDir('noop-update', ['keep-1', 'keep-2']);

    await runAndWait(`skillsmgr install "${sourceDir}" --all`, /Installed|installed/);

    const firstListing = await runAndWait('skillsmgr group list noop-update', /keep-1/);
    expect(firstListing).toContain('keep-1');
    expect(firstListing).toContain('keep-2');

    await runAndWait(`skillsmgr update "${sourceDir}"`, /Done!|up to date/);

    expect(existsSync(skillDeployedPath('noop-update', 'keep-1'))).toBe(true);
    expect(existsSync(skillDeployedPath('noop-update', 'keep-2'))).toBe(true);

    const secondListing = await runAndWait('skillsmgr group list noop-update', /keep-1/);
    expect(secondListing).toContain('keep-1');
    expect(secondListing).toContain('keep-2');
    expect(secondListing).not.toMatch(/keep-3|keep-4/);
  });

  it('Scenario: --sync 移除的 skill 从 group 中一并清理', async () => {
    const sourceDir = createSourceDir('drop-pack', ['stay-1', 'stay-2', 'dropme']);

    await runAndWait(`skillsmgr install "${sourceDir}" --all`, /Installed|installed/);

    expect(existsSync(skillDeployedPath('drop-pack', 'dropme'))).toBe(true);

    rmSync(join(sourceDir, 'dropme'), { recursive: true, force: true });

    const updateOutput = await runAndWait(
      `skillsmgr update "${sourceDir}" --sync`,
      /Done!/,
      30_000,
    );
    expect(updateOutput).toMatch(/dropme|removed/);

    expect(existsSync(skillDeployedPath('drop-pack', 'stay-1'))).toBe(true);
    expect(existsSync(skillDeployedPath('drop-pack', 'stay-2'))).toBe(true);
    expect(existsSync(skillDeployedPath('drop-pack', 'dropme'))).toBe(false);

    const listing = await runAndWait('skillsmgr group list drop-pack', /stay-1/);
    expect(listing).toContain('stay-1');
    expect(listing).toContain('stay-2');
    expect(listing).not.toContain('dropme');
  });
});

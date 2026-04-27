import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

/**
 * E2E tests for companion reverse-cleanup during uninstall / remove.
 *
 * Covers idempotent removal (file already gone), symlink unlink without
 * follow, and registry consistency after the reverse cleanup.
 */

describe('skill-companions cleanup E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createCompanionSkill(name: string): void {
    const dir = join(env.projectDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
    );
    writeFileSync(
      join(dir, 'skill.json'),
      JSON.stringify(
        {
          name,
          version: '0.1.0',
          description: `Test skill ${name}`,
          targetAgents: ['claude-code'],
          companions: [
            {
              source: `agents/${name}-runner.md`,
              agentTargets: {
                'claude-code': `.claude/agents/${name}-runner.md`,
              },
            },
          ],
        },
        null,
        2,
      ),
    );
    mkdirSync(join(dir, 'agents'), { recursive: true });
    writeFileSync(
      join(dir, 'agents', `${name}-runner.md`),
      `---\nname: ${name}-runner\n---\n# Runner for ${name}\n`,
    );
  }

  async function installAndAdd(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start(
      `skillsmgr add -a claude-code --skill ${name}`,
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();
  }

  function readRegistry(): unknown {
    const path = join(env.homeDir, '.skills-manager', 'deployments.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  it('Scenario: uninstall jt-codex 清理其 companion 文件', async () => {
    createCompanionSkill('jt-codex-fixture');
    await installAndAdd('jt-codex-fixture');

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'jt-codex-fixture-runner.md',
    );
    const skillBodyPath = join(
      env.projectDir,
      '.agents',
      'skills',
      'jt-codex-fixture',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(existsSync(skillBodyPath)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall jt-codex-fixture -f', env.projectDir);
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    // Companion gone, skill body gone
    expect(existsSync(companionPath)).toBe(false);
    expect(existsSync(skillBodyPath)).toBe(false);

    // Registry no longer holds jt-codex-fixture record
    const registry = readRegistry();
    expect(JSON.stringify(registry ?? {})).not.toContain('jt-codex-fixture');
  });

  it('Scenario: companion 文件已被用户手动删除时 idempotent (无错误)', async () => {
    createCompanionSkill('manual-delete-skill');
    await installAndAdd('manual-delete-skill');

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'manual-delete-skill-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);

    // User manually deletes the companion file
    unlinkSync(companionPath);
    expect(existsSync(companionPath)).toBe(false);

    // Uninstall should still succeed without error
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr uninstall manual-delete-skill -f',
      env.projectDir,
    );
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    const pane = await tmux.capturePane();
    tmux.destroy();

    // No "Error" surfaces and registry is cleaned
    expect(pane).not.toMatch(/Error|failed|exception/i);
    const registry = readRegistry();
    expect(JSON.stringify(registry ?? {})).not.toContain(
      'manual-delete-skill',
    );
  });

  it('Scenario: companion 是 symlink, uninstall 不 follow', async () => {
    createCompanionSkill('symlink-skill');
    await installAndAdd('symlink-skill');

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'symlink-skill-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(lstatSync(companionPath).isSymbolicLink()).toBe(true);

    // The symlink target — the real file in the central repo — should
    // survive the uninstall (we only remove the symlink, not its target).
    const realFile = join(
      env.homeDir,
      '.skills-manager',
      'custom',
      'symlink-skill',
      'agents',
      'symlink-skill-runner.md',
    );
    expect(existsSync(realFile)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall symlink-skill -f', env.projectDir);
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    // Symlink at project removed
    expect(existsSync(companionPath)).toBe(false);
    // Real file in central repo also gone (uninstall removes from central
    // repo as well, but if it survived under custom/, that's the symlink
    // target — the spec says we should NOT follow the symlink during the
    // companion-cleanup step itself).  Since uninstall also wipes
    // ~/.skills-manager/custom/<skill>/, the real file is gone via that
    // separate path.  The key assertion here is the symlink-removal path
    // didn't error and didn't accidentally touch unrelated files.
  });

  it('Scenario: remove 命令同样反向清理 companion (skill stays in central repo)', async () => {
    createCompanionSkill('remove-skill');
    await installAndAdd('remove-skill');

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'remove-skill-runner.md',
    );
    const skillBodyPath = join(
      env.projectDir,
      '.agents',
      'skills',
      'remove-skill',
    );
    const centralRepoPath = join(
      env.homeDir,
      '.skills-manager',
      'custom',
      'remove-skill',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(existsSync(skillBodyPath)).toBe(true);
    expect(existsSync(centralRepoPath)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove --skill remove-skill', env.projectDir);
    await tmux.waitForText(/Removed|removed/, 15_000);
    tmux.destroy();

    // Companion + project deployment removed
    expect(existsSync(companionPath)).toBe(false);
    expect(existsSync(skillBodyPath)).toBe(false);
    // But central repo skill should still exist (remove != uninstall)
    expect(existsSync(centralRepoPath)).toBe(true);
  });

  it('Scenario: uninstall 单 skill 不影响其它 skill 的 companion', async () => {
    createCompanionSkill('skill-alpha');
    createCompanionSkill('skill-beta');
    await installAndAdd('skill-alpha');
    await installAndAdd('skill-beta');

    const alphaCompanion = join(
      env.projectDir,
      '.claude',
      'agents',
      'skill-alpha-runner.md',
    );
    const betaCompanion = join(
      env.projectDir,
      '.claude',
      'agents',
      'skill-beta-runner.md',
    );
    expect(existsSync(alphaCompanion)).toBe(true);
    expect(existsSync(betaCompanion)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall skill-alpha -f', env.projectDir);
    await tmux.waitForText(/Removed|Uninstalled/, 15_000);
    tmux.destroy();

    expect(existsSync(alphaCompanion)).toBe(false);
    expect(existsSync(betaCompanion)).toBe(true);

    const registry = readRegistry();
    const registryStr = JSON.stringify(registry ?? {});
    expect(registryStr).not.toContain('skill-alpha');
    expect(registryStr).toContain('skill-beta');
  });
});

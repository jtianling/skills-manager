import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

/**
 * Acceptance E2E using the real jt-codex skill from skills-workspace.
 *
 * Smoke-test path that exercises the full install -> add -> verify ->
 * uninstall -> verify-cleanup loop with the actual fixture maintained
 * by skills-creator (companion: agents/jt-codex-runner.md ->
 * .claude/agents/jt-codex-runner.md, targetAgents: [claude-code]).
 *
 * Skipped on machines where the fixture path is missing (CI).
 */

const JT_CODEX_PATH = '/Users/jtianling/workspace/skills-workspace/skills/jt-codex';
const FIXTURE_AVAILABLE = existsSync(join(JT_CODEX_PATH, 'skill.json'));

describe.skipIf(!FIXTURE_AVAILABLE)('skill-companions real jt-codex acceptance', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeAll(() => {
    if (!FIXTURE_AVAILABLE) return;
    const manifest = JSON.parse(
      readFileSync(join(JT_CODEX_PATH, 'skill.json'), 'utf-8'),
    );
    expect(manifest.name).toBe('jt-codex');
    expect(manifest.targetAgents).toEqual(['claude-code']);
    expect(manifest.companions?.[0]?.source).toBe('agents/jt-codex-runner.md');
    expect(
      manifest.companions?.[0]?.agentTargets?.['claude-code'],
    ).toBe('.claude/agents/jt-codex-runner.md');
  });

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function readDeploymentsRegistry(): Record<string, unknown> {
    const path = join(env.homeDir, '.skills-manager', 'deployments.json');
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  async function installRealJtCodex(): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ${JT_CODEX_PATH}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 30_000);
    tmux.destroy();
  }

  it('Scenario: install + add to claude-code project deploys companion as symlink', async () => {
    await installRealJtCodex();

    expect(
      existsSync(join(env.homeDir, '.skills-manager', 'custom', 'jt-codex')),
    ).toBe(true);
    expect(
      existsSync(join(
        env.homeDir,
        '.skills-manager',
        'custom',
        'jt-codex',
        'agents',
        'jt-codex-runner.md',
      )),
    ).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill jt-codex',
      env.projectDir,
    );
    await tmux.waitForText(/✓ jt-codex|Done|deployed/i, 30_000);

    const skillBody = join(env.projectDir, '.agents', 'skills', 'jt-codex');
    expect(existsSync(skillBody)).toBe(true);

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'jt-codex-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(lstatSync(companionPath).isSymbolicLink()).toBe(true);

    const linkTarget = readlinkSync(companionPath);
    expect(linkTarget).toContain('jt-codex');
    expect(linkTarget).toContain('jt-codex-runner.md');

    const registryStr = JSON.stringify(readDeploymentsRegistry());
    expect(registryStr).toContain('jt-codex');
    expect(registryStr).toContain('jt-codex-runner.md');
    expect(registryStr).toContain('deployedCompanions');
  });

  it('Scenario: add to codex-only project is rejected by targetAgents', async () => {
    await installRealJtCodex();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a codex --skill jt-codex',
      env.projectDir,
    );
    await tmux.waitForText(
      /not.*applicable|targetAgents|incompatible|error|cannot/i,
      30_000,
    );

    expect(
      existsSync(join(env.projectDir, '.agents', 'skills', 'jt-codex')),
    ).toBe(false);
    expect(
      existsSync(join(env.projectDir, '.claude', 'agents', 'jt-codex-runner.md')),
    ).toBe(false);
  });

  it('Scenario: uninstall reverse-cleans companion + skill body + registry record', async () => {
    await installRealJtCodex();

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill jt-codex',
      env.projectDir,
    );
    await tmux.waitForText(/✓ jt-codex|Done|deployed/i, 30_000);
    tmux.destroy();

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'jt-codex-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall jt-codex -y', env.projectDir);
    await tmux.waitForText(/Uninstalled|uninstalled|removed/i, 30_000);

    expect(existsSync(companionPath)).toBe(false);
    expect(
      existsSync(join(env.projectDir, '.agents', 'skills', 'jt-codex')),
    ).toBe(false);

    const registry = readDeploymentsRegistry();
    expect(JSON.stringify(registry)).not.toContain('jt-codex');
  });
});

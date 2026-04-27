import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

/**
 * E2E tests for companion deploy-time conflict detection.
 *
 * Two skills cannot share the same companion target path. The deployer
 * SHALL pre-check, throw a clear error naming both skills and the
 * conflicting path, and not write or rollback any partial work.
 */

describe('skill-companions conflict E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createSkill(
    name: string,
    companions: Array<{
      source: string;
      agentTargets: Record<string, string>;
    }>,
    companionFiles: Record<string, string>,
  ): void {
    const dir = join(env.projectDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${name} test skill\n---\n# ${name}\n`,
    );
    writeFileSync(
      join(dir, 'skill.json'),
      JSON.stringify(
        {
          name,
          version: '0.1.0',
          description: `Test skill ${name}`,
          targetAgents: ['claude-code'],
          companions,
        },
        null,
        2,
      ),
    );
    for (const [rel, content] of Object.entries(companionFiles)) {
      const full = join(dir, rel);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }
  }

  async function installLocal(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();
  }

  it('Scenario: 两个 skill companion 目标路径冲突, 第二次 add 抛错且不覆盖', async () => {
    createSkill(
      'skill-first',
      [
        {
          source: 'agents/runner.md',
          agentTargets: { 'claude-code': '.claude/agents/runner.md' },
        },
      ],
      { 'agents/runner.md': '# first runner content\n' },
    );
    createSkill(
      'skill-second',
      [
        {
          source: 'agents/runner.md',
          agentTargets: { 'claude-code': '.claude/agents/runner.md' },
        },
      ],
      { 'agents/runner.md': '# second runner content\n' },
    );
    await installLocal('skill-first');
    await installLocal('skill-second');

    // Deploy first — succeeds
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill skill-first',
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();

    const targetPath = join(env.projectDir, '.claude', 'agents', 'runner.md');
    expect(existsSync(targetPath)).toBe(true);

    // Read what's there now (may be a symlink — read source content via FS)
    const firstContent = readFileSync(targetPath, 'utf-8');
    expect(firstContent).toContain('first runner content');

    // Deploy second — must error
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill skill-second',
      env.projectDir,
    );
    await tmux.waitForText(/conflict|already.*deployed|error/i, 15_000);
    const pane = await tmux.capturePane();
    tmux.destroy();

    // Error message names both skills
    expect(pane).toMatch(/skill-first/);
    expect(pane).toMatch(/skill-second/);
    // Error message names the conflicting path
    expect(pane).toMatch(/runner\.md|\.claude\/agents/);

    // First skill's content remains intact
    const afterContent = readFileSync(targetPath, 'utf-8');
    expect(afterContent).toContain('first runner content');
    expect(afterContent).not.toContain('second runner content');

    // skill-second's body should NOT be deployed (transactional rollback)
    expect(
      existsSync(join(env.projectDir, '.agents', 'skills', 'skill-second')),
    ).toBe(false);

    // Registry should NOT record skill-second
    const registryPath = join(env.homeDir, '.skills-manager', 'deployments.json');
    if (existsSync(registryPath)) {
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      expect(JSON.stringify(registry)).not.toContain('skill-second');
    }
  });

  it('Scenario: 同 skill 内 companions 自相冲突, deploy 抛错且不修改文件系统', async () => {
    createSkill(
      'self-conflict-skill',
      [
        {
          source: 'agents/a.md',
          agentTargets: { 'claude-code': '.claude/agents/conflict.md' },
        },
        {
          source: 'agents/b.md',
          agentTargets: { 'claude-code': '.claude/agents/conflict.md' },
        },
      ],
      {
        'agents/a.md': '# a\n',
        'agents/b.md': '# b\n',
      },
    );
    await installLocal('self-conflict-skill');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill self-conflict-skill',
      env.projectDir,
    );
    await tmux.waitForText(/conflict|duplicate|error/i, 15_000);
    const pane = await tmux.capturePane();
    tmux.destroy();

    // Error mentions internal/self conflict
    expect(pane).toMatch(/self-conflict-skill/);
    expect(pane).toMatch(/conflict\.md|conflict|duplicate/i);

    // Nothing written
    expect(
      existsSync(join(env.projectDir, '.claude', 'agents', 'conflict.md')),
    ).toBe(false);
    expect(
      existsSync(
        join(env.projectDir, '.agents', 'skills', 'self-conflict-skill'),
      ),
    ).toBe(false);
  });

  it('Scenario: 部署中途失败时已写入 companion 被回滚', async () => {
    // We trigger a partial-failure path by making the second companion's
    // target path collide with another skill's companion that was deployed
    // first (after the conflict pre-check is presumed to have passed).
    // The cleanest e2e proxy for "mid-flight failure rollback" is:
    //   - Skill A (already deployed): companion at .claude/agents/x.md
    //   - Skill B: declares two companions where the FIRST one has a clean
    //     unique path, the SECOND collides with skill A's path
    //   - We expect the pre-check to detect the collision before any write,
    //     so neither of B's companions reaches the filesystem and B's main
    //     body is also rolled back.
    createSkill(
      'pre-deployed',
      [
        {
          source: 'agents/owned.md',
          agentTargets: { 'claude-code': '.claude/agents/owned.md' },
        },
      ],
      { 'agents/owned.md': '# owned by pre-deployed\n' },
    );
    createSkill(
      'rollback-skill',
      [
        {
          source: 'agents/clean.md',
          agentTargets: { 'claude-code': '.claude/agents/clean.md' },
        },
        {
          source: 'agents/conflict.md',
          agentTargets: { 'claude-code': '.claude/agents/owned.md' },
        },
      ],
      {
        'agents/clean.md': '# clean\n',
        'agents/conflict.md': '# conflict\n',
      },
    );
    await installLocal('pre-deployed');
    await installLocal('rollback-skill');

    // Deploy pre-deployed first.  The success line uses the unique
    // checkmark so the wait pattern does not collide with the literal
    // skill name "pre-deployed" appearing inside the command echo.
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill pre-deployed',
      env.projectDir,
    );
    await tmux.waitForText(/✓ pre-deployed/, 15_000);
    tmux.destroy();
    expect(
      existsSync(join(env.projectDir, '.claude', 'agents', 'owned.md')),
    ).toBe(true);

    // Try to deploy rollback-skill — must abort transactionally
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill rollback-skill',
      env.projectDir,
    );
    await tmux.waitForText(/conflict|already.*deployed|error/i, 15_000);
    tmux.destroy();

    // The "clean" companion path must NOT have been written, even though
    // it was the first one in declaration order — pre-check must run BEFORE
    // any write.
    expect(
      existsSync(join(env.projectDir, '.claude', 'agents', 'clean.md')),
    ).toBe(false);
    // Skill body NOT deployed
    expect(
      existsSync(join(env.projectDir, '.agents', 'skills', 'rollback-skill')),
    ).toBe(false);
    // Original skill's companion still intact
    const owned = readFileSync(
      join(env.projectDir, '.claude', 'agents', 'owned.md'),
      'utf-8',
    );
    expect(owned).toContain('owned by pre-deployed');
  });
});

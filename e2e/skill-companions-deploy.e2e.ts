import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

/**
 * E2E tests for skill-companions deploy flow.
 *
 * Covers companion file dispatch when deploying a skill that declares
 * `companions[]` in skill.json — the file at <skillDir>/<source> must
 * be link/copy-deployed to <projectDir>/<agentTargets[agent]> for each
 * matching selected agent, and recorded in deployments-registry's
 * `deployedCompanions`.
 */

describe('skill-companions deploy E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function createSkillWithCompanions(
    name: string,
    options: {
      targetAgents?: string[];
      companions?: Array<{
        source: string;
        agentTargets: Record<string, string>;
      }>;
      companionFiles?: Record<string, string>;
    },
  ): string {
    const dir = join(env.projectDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
    );
    const manifest: Record<string, unknown> = {
      name,
      version: '0.1.0',
      description: `Test skill ${name}`,
    };
    if (options.targetAgents) manifest.targetAgents = options.targetAgents;
    if (options.companions) manifest.companions = options.companions;
    writeFileSync(join(dir, 'skill.json'), JSON.stringify(manifest, null, 2));
    for (const [rel, content] of Object.entries(options.companionFiles ?? {})) {
      const filePath = join(dir, rel);
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, content);
    }
    return dir;
  }

  async function installLocal(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();
  }

  function readDeploymentsRegistry(): Record<string, unknown> {
    const path = join(env.homeDir, '.skills-manager', 'deployments.json');
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  it('Scenario: jt-codex 部署到选中 claude-code 的 project (link 模式)', async () => {
    createSkillWithCompanions('jt-codex-fixture', {
      targetAgents: ['claude-code'],
      companions: [
        {
          source: 'agents/jt-codex-runner.md',
          agentTargets: {
            'claude-code': '.claude/agents/jt-codex-runner.md',
          },
        },
      ],
      companionFiles: {
        'agents/jt-codex-runner.md':
          '---\nname: jt-codex-runner\n---\n# Runner subagent\n',
      },
    });
    await installLocal('jt-codex-fixture');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill jt-codex-fixture',
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'jt-codex-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(lstatSync(companionPath).isSymbolicLink()).toBe(true);

    // Symlink target should point to the skill's real file in the central repo
    const linkTarget = readlinkSync(companionPath);
    expect(linkTarget).toContain('jt-codex-fixture');
    expect(linkTarget).toContain('jt-codex-runner.md');

    // Skill main body deployed
    expect(
      existsSync(
        join(env.projectDir, '.agents', 'skills', 'jt-codex-fixture'),
      ),
    ).toBe(true);

    // Registry records the absolute path
    const registry = readDeploymentsRegistry();
    const registryStr = JSON.stringify(registry);
    expect(registryStr).toContain('jt-codex-fixture');
    expect(registryStr).toContain('jt-codex-runner.md');
    expect(registryStr).toContain('deployedCompanions');
  });

  it('Scenario: copy 模式部署 companion (real file, not symlink)', async () => {
    createSkillWithCompanions('jt-codex-fixture', {
      targetAgents: ['claude-code'],
      companions: [
        {
          source: 'agents/jt-codex-runner.md',
          agentTargets: {
            'claude-code': '.claude/agents/jt-codex-runner.md',
          },
        },
      ],
      companionFiles: {
        'agents/jt-codex-runner.md': '# Runner real content\n',
      },
    });
    await installLocal('jt-codex-fixture');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill jt-codex-fixture --copy',
      env.projectDir,
    );
    await tmux.waitForText(/copied|deployed/i, 15_000);
    tmux.destroy();

    const companionPath = join(
      env.projectDir,
      '.claude',
      'agents',
      'jt-codex-runner.md',
    );
    expect(existsSync(companionPath)).toBe(true);
    expect(lstatSync(companionPath).isSymbolicLink()).toBe(false);

    const content = readFileSync(companionPath, 'utf-8');
    expect(content).toContain('Runner real content');
  });

  it('Scenario: companion agentTargets 不匹配已选 agent 时 skip (skill body still deployed)', async () => {
    // Skill itself targets only claude-code via companion's agentTargets
    // but no skill.targetAgents constraint — skill body should still deploy
    // when codex is the only selected agent; companion is skipped.
    createSkillWithCompanions('mixed-skill', {
      // no targetAgents → universal skill
      companions: [
        {
          source: 'helpers/claude-only.md',
          agentTargets: {
            'claude-code': '.claude/helpers/claude-only.md',
          },
        },
      ],
      companionFiles: {
        'helpers/claude-only.md': '# claude-only helper\n',
      },
    });
    await installLocal('mixed-skill');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a codex --skill mixed-skill',
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();

    // Companion target NOT created
    expect(
      existsSync(join(env.projectDir, '.claude', 'helpers', 'claude-only.md')),
    ).toBe(false);

    // Skill body still deployed under .agents/skills
    expect(
      existsSync(join(env.projectDir, '.agents', 'skills', 'mixed-skill')),
    ).toBe(true);

    // Registry shows empty deployedCompanions for this skill
    const registry = readDeploymentsRegistry();
    const registryStr = JSON.stringify(registry);
    expect(registryStr).toContain('mixed-skill');
    expect(registryStr).not.toContain('claude-only.md');
  });

  it('Scenario: 目标路径父目录不存在时自动创建', async () => {
    // Project dir initially has no .claude/agents/nested/deep/ structure
    createSkillWithCompanions('deep-companion-skill', {
      targetAgents: ['claude-code'],
      companions: [
        {
          source: 'agents/deep.md',
          agentTargets: {
            'claude-code': '.claude/agents/nested/deep/runner.md',
          },
        },
      ],
      companionFiles: {
        'agents/deep.md': '# deep content\n',
      },
    });
    await installLocal('deep-companion-skill');

    expect(existsSync(join(env.projectDir, '.claude', 'agents', 'nested')))
      .toBe(false);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill deep-companion-skill',
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();

    const target = join(
      env.projectDir,
      '.claude',
      'agents',
      'nested',
      'deep',
      'runner.md',
    );
    expect(existsSync(target)).toBe(true);
  });

  it('Scenario: 重新部署 (--refresh / re-add) 清空旧 companion 记录', async () => {
    createSkillWithCompanions('refresh-skill', {
      targetAgents: ['claude-code'],
      companions: [
        {
          source: 'agents/v1.md',
          agentTargets: { 'claude-code': '.claude/agents/v1.md' },
        },
        {
          source: 'agents/v2.md',
          agentTargets: { 'claude-code': '.claude/agents/v2.md' },
        },
      ],
      companionFiles: {
        'agents/v1.md': '# v1\n',
        'agents/v2.md': '# v2\n',
      },
    });
    await installLocal('refresh-skill');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add -a claude-code --skill refresh-skill',
      env.projectDir,
    );
    await tmux.waitForText(/linked|copied|deployed/i, 15_000);
    tmux.destroy();

    expect(existsSync(join(env.projectDir, '.claude', 'agents', 'v1.md'))).toBe(true);
    expect(existsSync(join(env.projectDir, '.claude', 'agents', 'v2.md'))).toBe(true);

    // Edit the central-repo skill.json: drop the v2 companion
    const centralSkillJson = join(
      env.homeDir,
      '.skills-manager',
      'custom',
      'refresh-skill',
      'skill.json',
    );
    expect(existsSync(centralSkillJson)).toBe(true);
    const m = JSON.parse(readFileSync(centralSkillJson, 'utf-8'));
    m.companions = [
      {
        source: 'agents/v1.md',
        agentTargets: { 'claude-code': '.claude/agents/v1.md' },
      },
    ];
    m.version = '0.2.0';
    writeFileSync(centralSkillJson, JSON.stringify(m, null, 2));

    // Re-deploy via deploy --refresh to pick up new manifest
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr deploy --refresh', env.projectDir);
    await tmux.waitForText(/Done|Deployed|deployed/i, 20_000);
    tmux.destroy();

    // v1 still there, v2 cleaned up
    expect(existsSync(join(env.projectDir, '.claude', 'agents', 'v1.md'))).toBe(true);
    expect(existsSync(join(env.projectDir, '.claude', 'agents', 'v2.md'))).toBe(false);

    const registry = readDeploymentsRegistry();
    const registryStr = JSON.stringify(registry);
    expect(registryStr).toContain('v1.md');
    expect(registryStr).not.toContain('v2.md');
  });
});

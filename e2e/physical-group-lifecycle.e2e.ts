import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('physical group lifecycle E2E (regressions)', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function makeBatchSource(groupName: string, skillNames: string[]): string {
    const root = join(tmpdir(), `e2e-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const batch = join(root, groupName);
    mkdirSync(batch, { recursive: true });
    for (const name of skillNames) {
      const dir = join(batch, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`,
      );
    }
    return batch;
  }

  async function installBatch(batchPath: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ${batchPath} -y`);
    await tmux.waitForText(/Installed/, 30_000);
    tmux.destroy();
  }

  function readGroupsJson(): Record<string, unknown> {
    const path = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(path)) return {};
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data.groups ?? {};
  }

  // Regression: bug 1 — interactive uninstall must group physical-group members under a header.
  // Previously loadGroupsData filtered out non-virtual groups, causing physical-group members
  // to render flat in the uninstall/deploy prompts.
  it('interactive uninstall prompt groups physical-group members under a folded header', async () => {
    const batch = makeBatchSource('tdd-batch', ['alpha', 'beta', 'gamma']);
    await installBatch(batch);

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall', env.projectDir);
    const output = await tmux.waitForText(/Select skills to uninstall/, 10_000);

    // Group header with member count must be visible (e.g., "tdd-batch (3)").
    expect(output).toMatch(/tdd-batch \(3\)/);
    // At least one member name must also be visible (folded open by default).
    expect(output).toMatch(/alpha|beta|gamma/);

    await tmux.pressKey('q');
  });

  // Regression: bug 2 — uninstalling all skills of a physical group via -s flag
  // (or interactive selection) must also clean up the physical group entry in groups.json,
  // not leave it orphan with count 0.
  it('uninstall -s for every member removes the physical group entry from groups.json', async () => {
    const batch = makeBatchSource('tdd-cleanup', ['one', 'two']);
    await installBatch(batch);

    // Precondition: physical group entry exists
    expect((readGroupsJson() as Record<string, { kind?: string }>)['tdd-cleanup']?.kind).toBe(
      'local-batch',
    );

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall -s one -s two -y', env.projectDir);
    await tmux.waitForText(/Uninstalled two|Uninstalled 2/, 15_000);
    tmux.destroy();

    // Physical directory gone
    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'tdd-cleanup'))).toBe(false);
    // Groups.json no longer has orphan entry
    expect(readGroupsJson()).not.toHaveProperty('tdd-cleanup');
  });

  // Regression: bug 2 — interactive uninstall path via selection checkboxes.
  // Complements the -s flag test above by exercising the interactive code path.
  it('interactive uninstall selecting all group members removes the physical group entry', async () => {
    const batch = makeBatchSource('tdd-interactive', ['mu', 'nu']);
    await installBatch(batch);

    expect((readGroupsJson() as Record<string, { kind?: string }>)['tdd-interactive']?.kind).toBe(
      'local-batch',
    );

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr uninstall', env.projectDir);
    await tmux.waitForText(/Select skills to uninstall/, 10_000);
    await tmux.sendKeys('C-a');
    await tmux.pressEnter();
    await tmux.waitForText(/Confirm uninstall/, 15_000);
    await tmux.pressKey('y');
    await tmux.pressEnter();
    await tmux.waitForText(/Uninstalled 2 skills/, 15_000);
    tmux.destroy();

    expect(existsSync(join(env.homeDir, '.skills-manager', 'custom', 'tdd-interactive'))).toBe(false);
    expect(readGroupsJson()).not.toHaveProperty('tdd-interactive');
  });
});

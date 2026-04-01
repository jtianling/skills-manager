import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('group remove batch E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function readGroups(): Record<string, string[]> {
    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(groupsPath)) return {};
    return JSON.parse(readFileSync(groupsPath, 'utf-8'));
  }

  function writeGroups(data: Record<string, string[]>): void {
    const dir = join(env.homeDir, '.skills-manager');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'groups.json'), JSON.stringify(data, null, 2));
  }

  function createLocalSkill(name: string): void {
    const skillDir = join(env.projectDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  async function installSkill(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();
  }

  it('batch removes skills from target by source group name', async () => {
    createLocalSkill('tool-a');
    createLocalSkill('tool-b');
    createLocalSkill('tool-c');
    await installSkill('tool-a');
    await installSkill('tool-b');
    await installSkill('tool-c');

    writeGroups({
      source: ['custom/tool-a', 'custom/tool-b'],
      target: ['custom/tool-a', 'custom/tool-b', 'custom/tool-c'],
    });

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove target source');
    const output = await tmux.waitForText(/Removed \d+ skills from group/, 10_000);

    expect(output).toContain("Removed 2 skills from group 'source' in 'target':");
    expect(output).toContain('tool-a (removed)');
    expect(output).toContain('tool-b (removed)');

    const groups = readGroups();
    expect(groups['target']).toEqual(['custom/tool-c']);
    // source group unchanged
    expect(groups['source']).toHaveLength(2);
  });

  it('skips skills not present in target group', async () => {
    createLocalSkill('shared');
    createLocalSkill('only-source');
    createLocalSkill('only-target');
    await installSkill('shared');
    await installSkill('only-source');
    await installSkill('only-target');

    writeGroups({
      source: ['custom/shared', 'custom/only-source'],
      target: ['custom/shared', 'custom/only-target'],
    });

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove target source');
    const output = await tmux.waitForText(/Removed \d+ skills from group/, 10_000);

    expect(output).toContain("Removed 1 skills from group 'source' in 'target':");
    expect(output).toContain('shared (removed)');
    expect(output).toContain('only-source (not in target, skipped)');

    const groups = readGroups();
    expect(groups['target']).toEqual(['custom/only-target']);
  });

  it('batch removes skills by owner/repo', async () => {
    const repoBase = join(env.homeDir, '.skills-manager', 'community', 'testowner', 'testrepo');
    const skillsDir = join(repoBase, 'skills');

    for (const name of ['alpha', 'beta']) {
      const skillDir = join(skillsDir, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: Test ${name}\n---\n# ${name}\n`,
      );
    }

    createLocalSkill('local-tool');
    await installSkill('local-tool');

    writeGroups({
      mygroup: [
        'community/testowner/testrepo/alpha',
        'community/testowner/testrepo/beta',
        'custom/local-tool',
      ],
    });

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove mygroup testowner/testrepo');
    const output = await tmux.waitForText(/Removed \d+ skills from repo/, 10_000);

    expect(output).toContain("Removed 2 skills from repo 'testowner/testrepo' in 'mygroup':");
    expect(output).toContain('alpha (removed)');
    expect(output).toContain('beta (removed)');

    const groups = readGroups();
    expect(groups['mygroup']).toEqual(['custom/local-tool']);
  });

  it('self-reference shows error', async () => {
    createLocalSkill('some-skill');
    await installSkill('some-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add mygroup some-skill');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove mygroup mygroup');
    const output = await tmux.waitForText(/Cannot remove a group from itself/, 10_000);

    expect(output).toContain('Cannot remove a group from itself');
  });

  it('empty source group shows nothing to remove', async () => {
    createLocalSkill('keeper');
    await installSkill('keeper');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create empty-src');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add target keeper');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove target empty-src');
    const output = await tmux.waitForText(/empty.*nothing to remove/, 10_000);

    expect(output).toContain("Group 'empty-src' is empty, nothing to remove.");

    const groups = readGroups();
    expect(groups['target']).toContain('custom/keeper');
  });

  it('single skill remove still works unchanged', async () => {
    createLocalSkill('removable');
    await installSkill('removable');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add cleanup removable');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove cleanup removable');
    const output = await tmux.waitForText(/Removed.*custom\/removable.*cleanup/, 10_000);

    expect(output).toContain("Removed 'custom/removable' from group 'cleanup'.");

    const groups = readGroups();
    expect(groups['cleanup']).toEqual([]);

    const skillDir = join(env.homeDir, '.skills-manager', 'custom', 'removable');
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);
  });
});

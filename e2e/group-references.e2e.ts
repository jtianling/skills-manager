import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

interface GroupsV2 {
  version: string;
  groups: Record<string, { kind: string; members?: string[] }>;
}

describe('group references (dynamic) E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

  function readGroupsV2(): GroupsV2 {
    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(groupsPath)) return { version: '2.0', groups: {} };
    return JSON.parse(readFileSync(groupsPath, 'utf-8'));
  }

  function membersOf(group: string): string[] {
    return readGroupsV2().groups[group]?.members ?? [];
  }

  function createLocalSkill(name: string): void {
    const base = join(env.projectDir, name);
    mkdirSync(base, { recursive: true });
    writeFileSync(
      join(base, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  async function installSkill(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr install ./${name}`, env.projectDir);
    await tmux.waitForText(/Installed|installed/, 15_000);
    tmux.destroy();
  }

  async function addToGroup(group: string, identifier: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr group add ${group} ${identifier}`);
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();
  }

  // Scenario: --group dynamic reference follows changes in the source group.
  it('group add --group creates a dynamic reference that follows source changes', async () => {
    // GIVEN: develop group with 1 skill, plus 2 vercel skills installed
    createLocalSkill('dev-base');
    createLocalSkill('vercel-logger');
    createLocalSkill('vercel-deploy');
    await installSkill('dev-base');
    await installSkill('vercel-logger');
    await installSkill('vercel-deploy');

    await addToGroup('develop', 'dev-base');

    // WHEN: vercel-develop references develop dynamically + holds 2 vercel skills
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add vercel-develop --group develop');
    const refOut = await tmux.waitForText(/Added reference to group 'develop'/, 10_000);
    tmux.destroy();
    expect(refOut).toContain("Added reference to group 'develop' to group 'vercel-develop'.");

    await addToGroup('vercel-develop', 'vercel-logger');
    await addToGroup('vercel-develop', 'vercel-deploy');

    // THEN: groups.json stores the reference, not a snapshot
    expect(membersOf('vercel-develop')).toEqual([
      'group:develop',
      'custom/vercel-logger',
      'custom/vercel-deploy',
    ]);

    // AND: group list annotates the reference (without expanding its skills)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group list vercel-develop');
    const listOut = await tmux.waitForText(/group: develop/, 10_000);
    tmux.destroy();
    expect(listOut).toContain('→ group: develop');
    expect(listOut).toContain('vercel-logger');

    // AND: deploying via --group expands the reference (getGroupMembers)
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add --group vercel-develop --all -a claude-code -y',
      env.projectDir,
    );
    await tmux.waitForText(/linked|deployed|already/, 20_000);
    tmux.destroy();
    const skillsDir = join(env.projectDir, '.agents', 'skills');
    expect(existsSync(join(skillsDir, 'dev-base'))).toBe(true);
    expect(existsSync(join(skillsDir, 'vercel-logger'))).toBe(true);

    // WHEN: a new skill is added to develop, then re-deployed
    createLocalSkill('dev-extra');
    await installSkill('dev-extra');
    await addToGroup('develop', 'dev-extra');

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr add --group vercel-develop --all -a claude-code -y',
      env.projectDir,
    );
    await tmux.waitForText(/linked|deployed|already|No new/, 20_000);
    tmux.destroy();

    // THEN: the dynamically-followed new skill is now deployed
    expect(existsSync(join(skillsDir, 'dev-extra'))).toBe(true);
    // reference member itself unchanged (no snapshot copy)
    expect(membersOf('vercel-develop')).toEqual([
      'group:develop',
      'custom/vercel-logger',
      'custom/vercel-deploy',
    ]);
  });

  // Scenario: group remove --group removes the reference.
  it('group remove --group removes the dynamic reference', async () => {
    createLocalSkill('dev-base');
    await installSkill('dev-base');
    await addToGroup('develop', 'dev-base');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add vercel-develop --group develop');
    await tmux.waitForText(/Added reference/, 10_000);
    tmux.destroy();

    expect(membersOf('vercel-develop')).toEqual(['group:develop']);

    // WHEN: remove the reference
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group remove vercel-develop --group develop');
    const out = await tmux.waitForText(/Removed reference to group 'develop'/, 10_000);
    tmux.destroy();
    expect(out).toContain("Removed reference to group 'develop' from group 'vercel-develop'.");

    // THEN: reference gone, develop itself untouched
    expect(membersOf('vercel-develop')).toEqual([]);
    expect(membersOf('develop')).toEqual(['custom/dev-base']);
  });

  // Scenario: --group self-reference is blocked.
  it('group add --group blocks self-reference', async () => {
    createLocalSkill('dev-base');
    await installSkill('dev-base');
    await addToGroup('develop', 'dev-base');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop --group develop');
    const out = await tmux.waitForText(/Cannot reference a group from itself/, 10_000);
    tmux.destroy();
    expect(out).toContain('Cannot reference a group from itself.');
  });
});

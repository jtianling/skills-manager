import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';

describe('group add batch E2E', () => {
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

  function createLocalSkill(name: string, parentDir?: string): void {
    const base = parentDir
      ? join(env.projectDir, parentDir, name)
      : join(env.projectDir, name);
    mkdirSync(base, { recursive: true });
    writeFileSync(
      join(base, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nA test skill.\n`,
    );
  }

  function installSkill(name: string, cwd?: string): Promise<void> {
    return new Promise(async (resolve) => {
      tmux = new TmuxSession(env);
      await tmux.start(`skillsmgr install ./${name}`, cwd ?? env.projectDir);
      await tmux.waitForText(/Installed|installed/, 15_000);
      tmux.destroy();
      resolve();
    });
  }

  // Scenario: identifier 匹配 group name — 批量添加
  it('group add with group name copies all skills from source group', async () => {
    // GIVEN: 3 skills installed, all in source group "tools"
    createLocalSkill('tool-a');
    createLocalSkill('tool-b');
    createLocalSkill('tool-c');
    await installSkill('tool-a');
    await installSkill('tool-b');
    await installSkill('tool-c');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add tools tool-a');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add tools tool-b');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add tools tool-c');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // WHEN: group add develop tools (identifier resolves to group)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop tools');
    const output = await tmux.waitForText(/tool-c/, 10_000);

    // THEN: all 3 skills copied to develop group
    expect(output).toContain('tool-a');
    expect(output).toContain('tool-b');
    expect(output).toContain('tool-c');

    const groups = readGroups();
    expect(groups['develop']).toContain('custom/tool-a');
    expect(groups['develop']).toContain('custom/tool-b');
    expect(groups['develop']).toContain('custom/tool-c');

    // AND: source group unchanged
    expect(groups['tools']).toHaveLength(3);
  });

  // Scenario: 自引用防护
  it('group add self-reference shows error', async () => {
    // GIVEN: group "mygroup" exists
    createLocalSkill('some-skill');
    await installSkill('some-skill');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add mygroup some-skill');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // WHEN: group add mygroup mygroup
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add mygroup mygroup');
    const output = await tmux.waitForText(/Cannot add a group to itself|not found/, 10_000);

    // THEN: error about self-reference
    expect(output).toContain('Cannot add a group to itself');
  });

  // Scenario: 空 group 批量添加
  it('group add from empty group shows error', async () => {
    // GIVEN: empty group "empty-src" exists
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group create empty-src');
    await tmux.waitForText(/Created group/, 10_000);
    tmux.destroy();

    // WHEN: group add develop empty-src
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop empty-src');
    const output = await tmux.waitForText(/empty|nothing to add/, 10_000);

    // THEN: error about empty group
    expect(output).toContain('empty');
  });

  // Scenario: 批量添加 key 已存在时静默跳过
  it('group add batch skips already-existing keys', async () => {
    // GIVEN: skill-x in both groups already
    createLocalSkill('skill-x');
    createLocalSkill('skill-y');
    await installSkill('skill-x');
    await installSkill('skill-y');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add src skill-x');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add src skill-y');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // skill-x already in target
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add target skill-x');
    await tmux.waitForText(/Added/, 10_000);
    tmux.destroy();

    // WHEN: batch add src → target
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add target src');
    await tmux.waitForText(/skill-y|skipped/, 10_000);

    // THEN: skill-x skipped, skill-y added
    const groups = readGroups();
    expect(groups['target']).toContain('custom/skill-x');
    expect(groups['target']).toContain('custom/skill-y');
    // no duplicates
    expect(groups['target'].filter((k: string) => k === 'custom/skill-x')).toHaveLength(1);
  });

  // Scenario: 无任何匹配
  it('group add with unknown identifier shows error', async () => {
    // WHEN: identifier matches nothing
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop nonexistent-xyz');
    const output = await tmux.waitForText(/not found|No skill/, 10_000);

    // THEN: error message
    expect(output).toMatch(/not found|No skill.*group.*repo/i);
  });

  // Scenario: identifier 匹配 owner/repo — 批量添加
  // This test requires a pre-installed community repo.
  // We simulate by writing the central repo structure directly.
  it('group add with owner/repo adds all repo skills', async () => {
    // GIVEN: simulate installed community/testowner/testrepo with 2 skills
    const repoBase = join(env.homeDir, '.skills-manager', 'community', 'testowner', 'testrepo');
    const skillsDir = join(repoBase, 'skills');

    for (const name of ['skill-alpha', 'skill-beta']) {
      const skillDir = join(skillsDir, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: Test ${name}\n---\n# ${name}\n`,
      );
    }

    // WHEN: group add develop testowner/testrepo
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop testowner/testrepo');
    const output = await tmux.waitForText(/skill-beta|skill-alpha/, 10_000);

    // THEN: both skills added to develop
    expect(output).toContain('skill-alpha');
    expect(output).toContain('skill-beta');

    const groups = readGroups();
    expect(groups['develop']).toContain('community/testowner/testrepo/skill-alpha');
    expect(groups['develop']).toContain('community/testowner/testrepo/skill-beta');
  });

  // Scenario: owner/repo 未安装
  it('group add with uninstalled owner/repo shows error', async () => {
    // WHEN: owner/repo not installed
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add develop fakowner/fakerepo');
    const output = await tmux.waitForText(/No installed skills|not found/, 10_000);

    // THEN: error message
    expect(output).toMatch(/No installed skills|not found/i);
  });

  // Scenario: name 冲突检测 — 单个添加 (覆盖)
  it('group add detects name conflict and allows replace', async () => {
    // GIVEN: two skills with same name "linter" from different sources
    const srcA = join(env.homeDir, '.skills-manager', 'custom', 'linter');
    mkdirSync(srcA, { recursive: true });
    writeFileSync(join(srcA, 'SKILL.md'), '---\nname: linter\ndescription: Linter A\n---\n# linter\n');

    const srcB = join(env.homeDir, '.skills-manager', 'community', 'bob', 'tools', 'skills', 'linter');
    mkdirSync(srcB, { recursive: true });
    writeFileSync(join(srcB, 'SKILL.md'), '---\nname: linter\ndescription: Linter B\n---\n# linter\n');

    // Add linter from custom source to group
    writeGroups({ mygrp: ['custom/linter'] });

    // WHEN: group add mygrp community/bob/tools/linter (same name, different key)
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add mygrp community/bob/tools/linter');

    // THEN: should detect name conflict and prompt
    const output = await tmux.waitForText(/Name conflict in group/, 15_000);
    expect(output).toMatch(/Name conflict in group/);
    expect(output).toMatch(/Replace.*custom\/linter.*community\/bob\/tools\/linter/);
    expect(output).toMatch(/Skip.*community\/bob\/tools\/linter/);
  });

  // Scenario: name 冲突检测 — 批量添加
  it('group add batch detects name conflicts per skill', async () => {
    // GIVEN: "target" group has custom/explore, "src" group has custom/pkg/explore (same name)
    const exploreA = join(env.homeDir, '.skills-manager', 'custom', 'explore');
    mkdirSync(exploreA, { recursive: true });
    writeFileSync(join(exploreA, 'SKILL.md'), '---\nname: explore\ndescription: Explore A\n---\n# explore\n');

    const exploreB = join(env.homeDir, '.skills-manager', 'custom', 'pkg', 'explore');
    mkdirSync(exploreB, { recursive: true });
    writeFileSync(join(exploreB, 'SKILL.md'), '---\nname: explore\ndescription: Explore B\n---\n# explore\n');

    const noConflict = join(env.homeDir, '.skills-manager', 'custom', 'pkg', 'unique-tool');
    mkdirSync(noConflict, { recursive: true });
    writeFileSync(join(noConflict, 'SKILL.md'), '---\nname: unique-tool\ndescription: No conflict\n---\n# unique-tool\n');

    writeGroups({
      target: ['custom/explore'],
      src: ['custom/pkg/explore', 'custom/pkg/unique-tool'],
    });

    // WHEN: group add target src — first skill triggers conflict prompt
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add target src');

    // THEN: conflict prompt appears for explore (same name, different key)
    const conflictOutput = await tmux.waitForText(/Name conflict in group/, 15_000);
    expect(conflictOutput).toMatch(/Name conflict in group 'target'/);
    expect(conflictOutput).toMatch(/Replace.*custom\/explore.*custom\/pkg\/explore/);

    // Choose "Skip" to proceed past the conflict
    await tmux.pressKey('Down');
    await tmux.pressEnter();

    // THEN: batch result shows unique-tool added and explore skipped
    const resultOutput = await tmux.waitForText(/unique-tool/, 10_000);
    expect(resultOutput).toContain('unique-tool');
  });

  // Scenario: 使用完整 source key 添加 (3+ segments, not owner/repo)
  it('group add with full source key adds directly', async () => {
    // GIVEN: a community skill installed
    const skillDir = join(env.homeDir, '.skills-manager', 'community', 'alice', 'repo', 'skills', 'formatter');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: formatter\ndescription: Formatter\n---\n# formatter\n');

    // WHEN: group add with full key
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr group add devtools community/alice/repo/formatter');
    const output = await tmux.waitForText(/Added.*community\/alice\/repo\/formatter.*devtools/, 15_000);

    // THEN: added with exact key
    expect(output).toContain("Added 'community/alice/repo/formatter' to group 'devtools'.");
    const groups = readGroups();
    expect(groups['devtools']).toContain('community/alice/repo/formatter');
  });
});

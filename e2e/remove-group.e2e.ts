import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TmuxSession, createTestEnv, type TestEnv } from './helpers/tmux.js';
import { getDeployedSkillNames } from './helpers/skills.js';

describe('remove --group E2E', () => {
  let env: TestEnv;
  let tmux: TmuxSession;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    tmux?.destroy();
    env?.cleanup();
  });

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

  async function deploySkill(name: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr add ${name} -a claude-code`, env.projectDir);
    await tmux.waitForText(/linked|already deployed/, 15_000);
    tmux.destroy();
  }

  async function addToGroup(group: string, skill: string): Promise<void> {
    tmux = new TmuxSession(env);
    await tmux.start(`skillsmgr group add ${group} ${skill}`);
    await tmux.waitForText(/Added|already in group/, 10_000);
    tmux.destroy();
  }

  function readGroups(): Record<string, string[]> {
    const groupsPath = join(env.homeDir, '.skills-manager', 'groups.json');
    if (!existsSync(groupsPath)) return {};
    return JSON.parse(readFileSync(groupsPath, 'utf-8'));
  }

  function getDeployedDir(): string {
    return join(env.projectDir, '.agents', 'skills');
  }

  // --- remove --group batch removal ---

  it('remove --group --all removes all deployed skills in group', async () => {
    createLocalSkill('alpha');
    createLocalSkill('beta');
    createLocalSkill('gamma');
    await installSkill('alpha');
    await installSkill('beta');
    await installSkill('gamma');
    await deploySkill('alpha');
    await deploySkill('beta');
    await deploySkill('gamma');
    await addToGroup('dev', 'alpha');
    await addToGroup('dev', 'beta');

    const deployedDir = getDeployedDir();
    expect(getDeployedSkillNames(deployedDir)).toContain('alpha');
    expect(getDeployedSkillNames(deployedDir)).toContain('beta');
    expect(getDeployedSkillNames(deployedDir)).toContain('gamma');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove --group dev --all', env.projectDir);
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    // alpha and beta removed
    expect(existsSync(join(deployedDir, 'alpha'))).toBe(false);
    expect(existsSync(join(deployedDir, 'beta'))).toBe(false);
    // gamma (not in group) still deployed
    expect(existsSync(join(deployedDir, 'gamma'))).toBe(true);
  });

  it('remove --group -y is equivalent to --group --all', async () => {
    createLocalSkill('skill-y');
    await installSkill('skill-y');
    await deploySkill('skill-y');
    await addToGroup('quick', 'skill-y');

    const deployedDir = getDeployedDir();
    expect(getDeployedSkillNames(deployedDir)).toContain('skill-y');

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove --group quick -y', env.projectDir);
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    expect(existsSync(join(deployedDir, 'skill-y'))).toBe(false);
  });

  it('remove --group with nonexistent group shows error', async () => {
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove --group nonexistent', env.projectDir);
    const output = await tmux.waitForText(/not found/, 10_000);
    expect(output).toContain('not found');
  });

  it('remove --group with no deployed skills in group shows error', async () => {
    createLocalSkill('installed-only');
    await installSkill('installed-only');
    await addToGroup('empty-deploy', 'installed-only');
    // skill is installed and in group but NOT deployed to project

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove --group empty-deploy --all',
      env.projectDir,
    );
    const output = await tmux.waitForText(/No deployed skills found/, 10_000);
    expect(output).toContain('No deployed skills found');
  });

  it('remove --group with skill name argument shows mutual exclusion error', async () => {
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove some-skill --group dev',
      env.projectDir,
    );
    const output = await tmux.waitForText(/Cannot use --group/, 10_000);
    expect(output).toContain('Cannot use --group');
  });

  // --- interactive remove with virtual group display ---

  it('interactive remove shows skills grouped by virtual group', async () => {
    createLocalSkill('tool-a');
    createLocalSkill('tool-b');
    createLocalSkill('tool-c');
    await installSkill('tool-a');
    await installSkill('tool-b');
    await installSkill('tool-c');
    await deploySkill('tool-a');
    await deploySkill('tool-b');
    await deploySkill('tool-c');
    await addToGroup('my-tools', 'tool-a');
    await addToGroup('my-tools', 'tool-b');
    // tool-c is ungrouped

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    const output = await tmux.waitForText(/Select skills to remove/, 10_000);

    // Should show group header
    expect(output).toContain('my-tools');

    // Quit without removing
    await tmux.pressKey('q');
    await tmux.pressKey('y');
  });

  it('interactive remove without groups shows flat list', async () => {
    createLocalSkill('flat-a');
    createLocalSkill('flat-b');
    await installSkill('flat-a');
    await installSkill('flat-b');
    await deploySkill('flat-a');
    await deploySkill('flat-b');
    // No group assignments

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    const output = await tmux.waitForText(/Select skills to remove/, 10_000);

    // Should show skill names without group headers
    expect(output).toContain('flat-a');
    expect(output).toContain('flat-b');
    expect(output).not.toContain('(ungrouped)');

    await tmux.pressKey('q');
    await tmux.pressKey('y');
  });

  it('interactive remove group header batch-selects all skills in group', async () => {
    createLocalSkill('batch-a');
    createLocalSkill('batch-b');
    createLocalSkill('batch-c');
    await installSkill('batch-a');
    await installSkill('batch-b');
    await installSkill('batch-c');
    await deploySkill('batch-a');
    await deploySkill('batch-b');
    await deploySkill('batch-c');
    await addToGroup('batch-grp', 'batch-a');
    await addToGroup('batch-grp', 'batch-b');
    // batch-c is ungrouped

    const deployedDir = getDeployedDir();

    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    await tmux.waitForText(/Select skills to remove/, 10_000);

    // Space on group header should select all in group
    await tmux.pressSpace();
    await tmux.pressEnter();

    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    // batch-a and batch-b should be removed (selected via group header)
    expect(existsSync(join(deployedDir, 'batch-a'))).toBe(false);
    expect(existsSync(join(deployedDir, 'batch-b'))).toBe(false);
    // batch-c should still be deployed
    expect(existsSync(join(deployedDir, 'batch-c'))).toBe(true);
  });

  it('interactive remove preserves source-based grouping with official and custom skills', async () => {
    // Install one official skill
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr install openai/skills -s skill-creator');
    await tmux.waitForText('Installed', 90_000);
    tmux.destroy();

    // Create and install custom skills
    createLocalSkill('rm-x');
    createLocalSkill('rm-y');
    await installSkill('rm-x');
    await installSkill('rm-y');
    await addToGroup('dev', 'rm-x');

    // Deploy all
    await deploySkill('skill-creator');
    await deploySkill('rm-x');
    await deploySkill('rm-y');

    // Run interactive remove
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    const output = await tmux.waitForText(/Select skills to remove/, 10_000);

    // Should show official and custom skills
    expect(output).toContain('skill-creator');
    expect(output).toContain('rm-x');
    expect(output).toContain('rm-y');

    // Official should appear before custom
    const officialPos = output.indexOf('skill-creator');
    const customPos = output.indexOf('rm-x');
    expect(officialPos).toBeLessThan(customPos);

    // Virtual group should appear within custom section
    expect(output).toContain('dev');

    // No (ungrouped) label — ungrouped skills appear flat
    expect(output).not.toContain('(ungrouped)');
    // rm-y (ungrouped) should still appear
    expect(output).toContain('rm-y');

    await tmux.pressKey('q');
  }, 120_000);

  // --- nested custom skill group matching ---

  it('interactive remove groups nested custom skills correctly', async () => {
    // Install a flat skill first to trigger setup
    createLocalSkill('flat-one');
    await installSkill('flat-one');

    // Create nested custom skill structure: custom/sub-pkg/nested-a, custom/sub-pkg/nested-b
    const customSubDir = join(env.homeDir, '.skills-manager', 'custom', 'sub-pkg');
    mkdirSync(join(customSubDir, 'nested-a'), { recursive: true });
    writeFileSync(
      join(customSubDir, 'nested-a', 'SKILL.md'),
      '---\nname: nested-a\ndescription: Nested skill A\n---\n# nested-a\nA nested test skill.\n',
    );
    mkdirSync(join(customSubDir, 'nested-b'), { recursive: true });
    writeFileSync(
      join(customSubDir, 'nested-b', 'SKILL.md'),
      '---\nname: nested-b\ndescription: Nested skill B\n---\n# nested-b\nA nested test skill.\n',
    );

    // Deploy all three
    await deploySkill('nested-a');
    await deploySkill('nested-b');
    await deploySkill('flat-one');

    // Add nested skills to a group
    await addToGroup('nested-grp', 'nested-a');
    await addToGroup('nested-grp', 'nested-b');

    // Verify group keys include nested source path (custom/sub-pkg/*, not custom/*)
    const groups = readGroups();
    expect(groups['nested-grp']).toContain('custom/sub-pkg/nested-a');
    expect(groups['nested-grp']).toContain('custom/sub-pkg/nested-b');

    // Run interactive remove — nested skills should appear under nested-grp header
    tmux = new TmuxSession(env);
    await tmux.start('skillsmgr remove', env.projectDir);
    const output = await tmux.waitForText(/Select skills to remove/, 10_000);

    expect(output).toContain('nested-grp');
    expect(output).toContain('nested-a');
    expect(output).toContain('nested-b');

    await tmux.pressKey('q');
  });

  // --- group reference cleanup ---

  it('remove cleans up group references in groups.json', async () => {
    createLocalSkill('cleanup-skill');
    await installSkill('cleanup-skill');
    await deploySkill('cleanup-skill');
    await addToGroup('cleanup-grp', 'cleanup-skill');

    // Verify group has the skill
    let groups = readGroups();
    expect(groups['cleanup-grp']).toContain('custom/cleanup-skill');

    // Remove the deployed skill
    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove cleanup-skill',
      env.projectDir,
    );
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    // Group reference should be cleaned up
    groups = readGroups();
    expect(groups['cleanup-grp'] ?? []).not.toContain('custom/cleanup-skill');
  });

  it('remove skill not in any group does not error', async () => {
    createLocalSkill('no-group-skill');
    await installSkill('no-group-skill');
    await deploySkill('no-group-skill');

    const deployedDir = getDeployedDir();
    expect(existsSync(join(deployedDir, 'no-group-skill'))).toBe(true);

    tmux = new TmuxSession(env);
    await tmux.start(
      'skillsmgr remove no-group-skill',
      env.projectDir,
    );
    await tmux.waitForText(/Removed|✓/, 10_000);
    tmux.destroy();

    expect(existsSync(join(deployedDir, 'no-group-skill'))).toBe(false);
  });
});

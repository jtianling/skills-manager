import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import {
  buildVirtualGroupChoices,
  buildSourceGroupedChoices,
  getSourceSuffix,
  loadGroupsData,
  promptAgents,
  promptSkills,
  promptSkillsToInstall,
  promptSkillsToUninstall,
  resolveTargetAgents,
} from './prompts.js';
import { interactiveCheckbox } from './interactive-select.js';
import type { ToolName } from '../constants.js';

describe('prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
  });

  it('groups Codex under Agents Skills Standard', async () => {
    await promptAgents(['codex']);

    const choices = vi.mocked(interactiveCheckbox).mock.calls[0][0].choices;
    expect(choices[0].name).toContain('Codex');
    expect(choices[0].value).toBe('agents-skills-standard');
    expect(choices.some((choice) => choice.value === 'codex')).toBe(false);
  });

  it('builds grouped uninstall choices with unchecked defaults', async () => {
    await promptSkillsToUninstall([
      {
        name: 'commit',
        description: 'Commit skill',
        path: '/skills/official/anthropic/skills/commit',
        source: 'official/anthropic/skills',
      },
      {
        name: 'my-skill',
        description: 'Community skill',
        path: '/skills/community/owner/repo/my-skill',
        source: 'community/owner/repo',
      },
    ]);

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: 'Select skills to uninstall:',
      choices: [
        {
          name: 'commit',
          description: 'Commit skill',
          value: '/skills/official/anthropic/skills/commit',
          checked: undefined,
          group: 'official',
          subGroup: 'anthropic/skills',
          suffix: undefined,
          locked: undefined,
        },
        {
          name: 'my-skill',
          description: 'Community skill',
          value: '/skills/community/owner/repo/my-skill',
          checked: undefined,
          group: 'community',
          subGroup: 'owner/repo',
          suffix: undefined,
          locked: undefined,
        },
      ],
      pageSize: 15,
    });
  });

  it('keeps deployed markers in deploy choices', async () => {
    await promptSkills(
      [
        {
          name: 'commit',
          description: 'Commit skill',
          path: '/skills/official/anthropic/skills/commit',
          source: 'official/anthropic/skills',
        },
        {
          name: 'review',
          description: 'Review skill',
          path: '/skills/custom/review',
          source: 'custom',
        },
      ],
      ['commit']
    );

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: 'Select skills to deploy:',
      choices: [
        {
          name: 'commit',
          description: 'Commit skill',
          value: 'commit',
          checked: true,
          group: 'official',
          subGroup: 'anthropic/skills',
          suffix: '[deployed]',
          locked: undefined,
        },
        {
          name: 'review',
          description: 'Review skill',
          value: 'review',
          checked: undefined,
          group: 'custom',
          subGroup: undefined,
          suffix: undefined,
          locked: undefined,
        },
      ],
      pageSize: 15,
    });
  });

  it('uses virtual groups in deploy choices when groupsData is provided', async () => {
    await promptSkills(
      [
        {
          name: 'commit',
          description: 'Commit skill',
          path: '/skills/official/anthropic/skills/commit',
          source: 'official/anthropic/skills',
        },
        {
          name: 'review',
          description: 'Review skill',
          path: '/skills/custom/review',
          source: 'custom',
        },
      ],
      ['commit'],
      {
        develop: ['official/anthropic/skills/commit', 'custom/review'],
      },
    );

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: 'Select skills to deploy:',
      choices: [
        {
          name: 'commit',
          description: 'Commit skill',
          value: 'commit',
          checked: true,
          suffix: '[deployed]',
          locked: undefined,
          group: 'official',
          subGroup: 'anthropic/skills',
        },
        {
          name: 'commit',
          description: 'Commit skill',
          value: 'commit',
          checked: true,
          innerGroup: 'anthropic/skills',
          suffix: '[deployed]',
          locked: undefined,
          group: 'custom',
          subGroup: 'develop',
        },
        {
          name: 'review',
          description: 'Review skill',
          value: 'review',
          checked: undefined,
          suffix: undefined,
          locked: undefined,
          group: 'custom',
          subGroup: 'develop',
        },
      ],
      pageSize: 15,
    });
  });

  it('uses virtual groups in uninstall choices when groupsData is provided', async () => {
    await promptSkillsToUninstall(
      [
        {
          name: 'commit',
          description: 'Commit skill',
          path: '/skills/official/anthropic/skills/commit',
          source: 'official/anthropic/skills',
        },
      ],
      {
        develop: ['official/anthropic/skills/commit'],
      },
    );

    expect(interactiveCheckbox).toHaveBeenCalledWith({
      message: 'Select skills to uninstall:',
      choices: [
        {
          name: 'commit',
          description: 'Commit skill',
          value: '/skills/official/anthropic/skills/commit',
          checked: undefined,
          suffix: undefined,
          locked: undefined,
          group: 'official',
          subGroup: 'anthropic/skills',
        },
        {
          name: 'commit',
          description: 'Commit skill',
          value: '/skills/official/anthropic/skills/commit',
          checked: undefined,
          innerGroup: 'anthropic/skills',
          suffix: undefined,
          locked: undefined,
          group: 'custom',
          subGroup: 'develop',
        },
      ],
      pageSize: 15,
    });
  });

  it('returns isAll true when all non-locked skills are selected', async () => {
    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['alpha', 'beta', 'gamma']);

    const result = await promptSkillsToInstall(
      [
        { name: 'alpha', description: 'A' },
        { name: 'beta', description: 'B' },
        { name: 'gamma', description: 'C' },
      ],
      new Set(['alpha']),
    );

    expect(result).toEqual({
      names: ['beta', 'gamma'],
      isAll: true,
    });
  });

  it('returns isAll false for partial or empty selections', async () => {
    vi.mocked(interactiveCheckbox).mockResolvedValueOnce(['beta']);

    const partial = await promptSkillsToInstall([
      { name: 'alpha', description: 'A' },
      { name: 'beta', description: 'B' },
    ]);

    expect(partial).toEqual({
      names: ['beta'],
      isAll: false,
    });

    vi.mocked(interactiveCheckbox).mockResolvedValueOnce([]);

    const empty = await promptSkillsToInstall([
      { name: 'alpha', description: 'A' },
      { name: 'beta', description: 'B' },
    ]);

    expect(empty).toEqual({
      names: [],
      isAll: false,
    });
  });

  it('loads virtual groups data from groups service', () => {
    const groupsService = {
      listGroups: () => ['develop', 'ops'],
      getGroupKind: () => 'virtual',
      getGroupMembers: (name: string) => ({
        develop: ['custom/jt-codex'],
        ops: ['custom/jt-release'],
      }[name] ?? []),
    };

    expect(loadGroupsData(groupsService as never)).toEqual({
      develop: ['custom/jt-codex'],
      ops: ['custom/jt-release'],
    });
  });

  it('includes physical (local-batch) groups with members derived from filesystem', () => {
    const groupsService = {
      listGroups: () => ['tdd-spec', 'develop'],
      getGroupKind: (name: string) => ({
        'tdd-spec': 'local-batch',
        develop: 'virtual',
      }[name]),
      getGroupMembers: (name: string) => ({
        'tdd-spec': ['custom/tdd-spec/ts-apply', 'custom/tdd-spec/ts-verify'],
        develop: ['custom/jt-codex'],
      }[name] ?? []),
    };

    expect(loadGroupsData(groupsService as never)).toEqual({
      'tdd-spec': ['custom/tdd-spec/ts-apply', 'custom/tdd-spec/ts-verify'],
      develop: ['custom/jt-codex'],
    });
  });

  it('builds virtual group choices with ungrouped last', () => {
    const choices = buildVirtualGroupChoices(
      [
        {
          name: 'tool-a',
          description: 'A',
          path: '/skills/custom/tool-a',
          source: 'custom',
        },
        {
          name: 'tool-b',
          description: 'B',
          path: '/skills/custom/tool-b',
          source: 'custom',
        },
        {
          name: 'tool-c',
          description: 'C',
          path: '/skills/custom/tool-c',
          source: 'custom',
        },
      ],
      {
        beta: ['custom/tool-b'],
        alpha: ['custom/tool-a'],
      },
    );

    expect(choices).toEqual([
      {
        name: 'tool-a',
        description: 'A',
        value: 'tool-a',
        suffix: undefined,
        locked: undefined,
        subGroup: 'alpha',
      },
      {
        name: 'tool-b',
        description: 'B',
        value: 'tool-b',
        suffix: undefined,
        locked: undefined,
        subGroup: 'beta',
      },
      {
        name: 'tool-c',
        description: 'C',
        value: 'tool-c',
        suffix: undefined,
        locked: undefined,
        subGroup: undefined,
      },
    ]);
  });

  it('shows skill in all matching virtual groups', () => {
    const choices = buildVirtualGroupChoices(
      [
        {
          name: 'jt-codex',
          description: 'Codex',
          path: '/skills/custom/jt-codex',
          source: 'custom',
        },
      ],
      {
        'jt-tools': ['custom/jt-codex'],
        openspec: ['custom/jt-codex'],
      },
    );

    expect(choices).toEqual([
      {
        name: 'jt-codex',
        description: 'Codex',
        value: 'jt-codex',
        suffix: undefined,
        locked: undefined,
        subGroup: 'jt-tools',
      },
      {
        name: 'jt-codex',
        description: 'Codex',
        value: 'jt-codex',
        suffix: undefined,
        locked: undefined,
        subGroup: 'openspec',
      },
    ]);
  });

  it('shows empty group header when no skills match the group', () => {
    const choices = buildVirtualGroupChoices(
      [
        {
          name: 'flat-a',
          description: 'A',
          path: '/skills/custom/flat-a',
          source: 'custom',
        },
        {
          name: 'flat-b',
          description: 'B',
          path: '/skills/custom/flat-b',
          source: 'custom',
        },
      ],
      {
        unused: ['custom/other'],
      },
    );

    expect(choices).toEqual([
      {
        name: '(empty)',
        description: undefined,
        value: '__empty_unused',
        locked: true,
        subGroup: 'unused',
      },
      {
        name: 'flat-a',
        description: 'A',
        value: 'flat-a',
        suffix: undefined,
        locked: undefined,
        subGroup: undefined,
      },
      {
        name: 'flat-b',
        description: 'B',
        value: 'flat-b',
        suffix: undefined,
        locked: undefined,
        subGroup: undefined,
      },
    ]);
  });

  it('supports custom suffix and locked callbacks for virtual group choices', () => {
    const choices = buildVirtualGroupChoices(
      [
        {
          name: 'locked-skill',
          description: 'Locked',
          path: '/skills/custom/locked-skill',
          source: 'custom',
        },
      ],
      {
        dev: ['custom/locked-skill'],
      },
      {
        getSuffix: () => '[deployed]',
        getLocked: () => true,
      },
    );

    expect(choices).toEqual([
      {
        name: 'locked-skill',
        description: 'Locked',
        value: 'locked-skill',
        suffix: '[deployed]',
        locked: true,
        subGroup: 'dev',
      },
    ]);
  });
});

describe('getSourceSuffix', () => {
  it('returns undefined for custom source', () => {
    expect(getSourceSuffix('custom')).toBeUndefined();
    expect(getSourceSuffix('custom/sub-pkg')).toBeUndefined();
  });

  it('returns owner/repo for official source', () => {
    expect(getSourceSuffix('official/anthropic/skills')).toBe('(anthropic/skills)');
  });

  it('returns owner/repo for community source', () => {
    expect(getSourceSuffix('community/bob/tools')).toBe('(bob/tools)');
  });
});

describe('buildVirtualGroupChoices innerGroup', () => {
  it('adds innerGroup for official skill in virtual group', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    expect(choices).toEqual([
      {
        name: 'commit',
        description: 'Commit',
        value: 'commit',
        innerGroup: 'anthropic/skills',
        suffix: undefined,
        locked: undefined,
        subGroup: 'dev',
      },
      {
        name: 'my-tool',
        description: 'My tool',
        value: 'my-tool',
        suffix: undefined,
        locked: undefined,
        subGroup: 'dev',
      },
    ]);
  });

  it('keeps functional suffix while using innerGroup', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
      { getSuffix: () => '[deployed]' },
    );

    expect(choices[0].innerGroup).toBe('anthropic/skills');
    expect(choices[0].suffix).toBe('[deployed]');
  });

  it('does not add innerGroup for ungrouped skills', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
    );

    const review = choices.find(c => c.name === 'review')!;
    expect(review.suffix).toBeUndefined();
    expect(review.innerGroup).toBeUndefined();
    expect(review.subGroup).toBeUndefined();
  });

  it('adds innerGroup for custom sub-path skill in virtual group', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      { develop: ['custom/openspec/openspec-apply'] },
    );

    expect(choices[0].innerGroup).toBe('openspec');
    expect(choices[0].subGroup).toBe('develop');
  });

  it('skips innerGroup when it equals subGroup for custom sub-path skill', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      { openspec: ['custom/openspec/openspec-apply'] },
    );

    expect(choices[0].innerGroup).toBeUndefined();
    expect(choices[0].subGroup).toBe('openspec');
  });
});

describe('buildSourceGroupedChoices cross-source virtual groups', () => {
  it('shows official skill in both source and virtual group', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commitChoices = choices.filter(c => c.name === 'commit');
    expect(commitChoices).toHaveLength(2);

    const commitOfficial = commitChoices.find(c => c.group === 'official')!;
    expect(commitOfficial.subGroup).toBe('anthropic/skills');
    expect(commitOfficial.innerGroup).toBeUndefined();
    expect(commitOfficial.suffix).toBeUndefined();

    const commitVg = commitChoices.find(c => c.subGroup === 'dev')!;
    expect(commitVg.innerGroup).toBe('anthropic/skills');
    expect(commitVg.suffix).toBeUndefined();

    const review = choices.find(c => c.name === 'review')!;
    expect(review.subGroup).toBe('anthropic/skills');
    expect(review.group).toBe('official');
    expect(review.innerGroup).toBeUndefined();
    expect(review.suffix).toBeUndefined();

    const myTool = choices.find(c => c.name === 'my-tool')!;
    expect(myTool.subGroup).toBe('dev');
    expect(myTool.innerGroup).toBeUndefined();
    expect(myTool.suffix).toBeUndefined();
  });

  it('skill appears in source category and all virtual groups', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commitChoices = choices.filter(c => c.name === 'commit');
    expect(commitChoices).toHaveLength(2);
    expect(commitChoices[0].group).toBe('official');
    expect(commitChoices[0].subGroup).toBe('anthropic/skills');
    expect(commitChoices[1].group).toBe('custom');
    expect(commitChoices[1].subGroup).toBe('dev');
    expect(commitChoices[1].innerGroup).toBe('anthropic/skills');
  });

  it('official source sub-group remains when skills belong to virtual group', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const officialChoices = choices.filter(c => c.group === 'official');
    expect(officialChoices).toHaveLength(1);
    expect(officialChoices[0].name).toBe('commit');
  });

  it('shows empty virtual group header in custom section', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['custom/my-tool'], 'empty-group': [] },
    );

    const emptyChoice = choices.find(c => c.subGroup === 'empty-group')!;
    expect(emptyChoice.name).toBe('(empty)');
    expect(emptyChoice.locked).toBe(true);
    expect(emptyChoice.group).toBe('custom');
  });

  it('behaves unchanged when no virtual groups', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      {},
    );

    const commit = choices.find(c => c.name === 'commit')!;
    expect(commit.group).toBe('official');
    expect(commit.subGroup).toBe('anthropic/skills');

    const myTool = choices.find(c => c.name === 'my-tool')!;
    expect(myTool.group).toBe('custom');
  });

  it('custom sub-path skill gets innerGroup in virtual group', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      { develop: ['custom/openspec/openspec-apply'] },
    );

    const inDevelop = choices.find(c => c.subGroup === 'develop')!;
    expect(inDevelop.innerGroup).toBe('openspec');
    expect(inDevelop.group).toBe('custom');
  });

  it('custom sub-path skill skips innerGroup when same as subGroup', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      { openspec: ['custom/openspec/openspec-apply'] },
    );

    const inOpenspec = choices.find(c => c.subGroup === 'openspec')!;
    expect(inOpenspec.innerGroup).toBeUndefined();
    expect(inOpenspec.group).toBe('custom');
  });
});

describe('resolveTargetAgents', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
  });

  it('uses single agent from -a flag', async () => {
    const result = await resolveTargetAgents(
      { agent: ['claude-code'] },
      () => [] as ToolName[],
    );
    expect(result).toEqual(['claude-code']);
  });

  it('uses multiple agents from repeated -a flag', async () => {
    const result = await resolveTargetAgents(
      { agent: ['claude-code', 'cursor'] },
      () => [] as ToolName[],
    );
    expect(result).toEqual(['claude-code', 'cursor']);
  });

  it('exits on invalid agent name', async () => {
    await resolveTargetAgents(
      { agent: ['invalid-name'] },
      () => [] as ToolName[],
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("Unknown agent: 'invalid-name'")
    );
  });

  it('returns configured tools for -s flag', async () => {
    const result = await resolveTargetAgents(
      { sameAgents: true },
      () => ['claude-code', 'codex'] as ToolName[],
    );
    expect(result).toEqual(['claude-code', 'codex']);
  });

  it('exits when -s used with no configured agents', async () => {
    await resolveTargetAgents(
      { sameAgents: true },
      () => [] as ToolName[],
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('No agents configured')
    );
  });

  it('exits when -a and --same-agents used together', async () => {
    await resolveTargetAgents(
      { agent: ['claude-code'], sameAgents: true },
      () => [] as ToolName[],
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockLog).toHaveBeenCalledWith(
      'Cannot use --agent and --same-agents together.'
    );
  });

  it('falls back to interactive prompt when no flags', async () => {
    vi.mocked(interactiveCheckbox).mockResolvedValue(['claude-code']);
    const getConfigured = () => ['cursor'] as ToolName[];

    const result = await resolveTargetAgents({}, getConfigured);

    expect(result).toEqual(['claude-code']);
    expect(interactiveCheckbox).toHaveBeenCalled();
  });

  it('uses global prompt when global=true', async () => {
    vi.mocked(interactiveCheckbox).mockResolvedValue(['claude-code']);
    const getConfigured = () => [] as ToolName[];

    const result = await resolveTargetAgents({}, getConfigured, true);

    expect(result).toEqual(['claude-code']);
    expect(interactiveCheckbox).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Select target agents for global install:',
      })
    );
  });

  it('-a flag works with global=true', async () => {
    const result = await resolveTargetAgents(
      { agent: ['amp'] },
      () => [] as ToolName[],
      true,
    );
    expect(result).toEqual(['amp']);
  });
});

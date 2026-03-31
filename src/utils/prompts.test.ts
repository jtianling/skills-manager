import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import {
  buildVirtualGroupChoices,
  buildSourceGroupedChoices,
  getSourceSuffix,
  loadGroupsData,
  mergeSuffix,
  promptSkills,
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
          name: 'review',
          description: 'Review skill',
          value: 'review',
          checked: undefined,
          suffix: undefined,
          locked: undefined,
          group: undefined,
          subGroup: 'develop',
        },
        {
          name: 'commit',
          description: 'Commit skill',
          value: 'commit',
          checked: true,
          suffix: '(anthropic/skills) [deployed]',
          locked: undefined,
          group: undefined,
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
          suffix: '(anthropic/skills)',
          locked: undefined,
          group: undefined,
          subGroup: 'develop',
        },
      ],
      pageSize: 15,
    });
  });

  it('loads virtual groups data from groups service', () => {
    const groupsService = {
      listGroups: () => ['develop', 'ops'],
      getGroup: (name: string) => ({
        develop: ['custom/jt-codex'],
        ops: ['custom/jt-release'],
      }[name] ?? null),
    };

    expect(loadGroupsData(groupsService as never)).toEqual({
      develop: ['custom/jt-codex'],
      ops: ['custom/jt-release'],
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

  it('uses the first matching virtual group alphabetically', () => {
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
    ]);
  });

  it('falls back to a flat list when no skills belong to any virtual group', () => {
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

describe('mergeSuffix', () => {
  it('merges multiple parts', () => {
    expect(mergeSuffix('(anthropic/skills)', '[deployed]')).toBe('(anthropic/skills) [deployed]');
  });

  it('filters undefined parts', () => {
    expect(mergeSuffix(undefined, '[deployed]')).toBe('[deployed]');
    expect(mergeSuffix('(a/b)', undefined)).toBe('(a/b)');
  });

  it('returns undefined when all parts are undefined', () => {
    expect(mergeSuffix(undefined, undefined)).toBeUndefined();
  });
});

describe('buildVirtualGroupChoices source suffix', () => {
  it('adds source suffix for official skill in virtual group', () => {
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
        suffix: '(anthropic/skills)',
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

  it('combines source suffix with functional suffix', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
      { getSuffix: () => '[deployed]' },
    );

    expect(choices[0].suffix).toBe('(anthropic/skills) [deployed]');
  });

  it('does not add source suffix for ungrouped skills', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
    );

    const review = choices.find(c => c.name === 'review')!;
    expect(review.suffix).toBeUndefined();
    expect(review.subGroup).toBeUndefined();
  });
});

describe('buildSourceGroupedChoices cross-source virtual groups', () => {
  it('moves official skill to virtual group with source suffix', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commit = choices.find(c => c.name === 'commit')!;
    expect(commit.subGroup).toBe('dev');
    expect(commit.suffix).toBe('(anthropic/skills)');

    const review = choices.find(c => c.name === 'review')!;
    expect(review.subGroup).toBe('anthropic/skills');
    expect(review.group).toBe('official');
    expect(review.suffix).toBeUndefined();

    const myTool = choices.find(c => c.name === 'my-tool')!;
    expect(myTool.subGroup).toBe('dev');
    expect(myTool.suffix).toBeUndefined();
  });

  it('official skill not duplicated in source category', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commitChoices = choices.filter(c => c.name === 'commit');
    expect(commitChoices).toHaveLength(1);
    expect(commitChoices[0].subGroup).toBe('dev');
  });

  it('hides empty source sub-group when all skills moved to virtual group', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const officialChoices = choices.filter(c => c.group === 'official');
    expect(officialChoices).toHaveLength(0);
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

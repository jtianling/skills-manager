import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import {
  buildVirtualGroupChoices,
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
          name: 'my-skill',
          description: 'Community skill',
          value: '/skills/community/owner/repo/my-skill',
          checked: false,
          group: 'community',
          subGroup: 'owner/repo',
        },
        {
          name: 'commit',
          description: 'Commit skill',
          value: '/skills/official/anthropic/skills/commit',
          checked: false,
          group: 'official',
          subGroup: 'anthropic/skills',
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
          name: 'review',
          description: 'Review skill',
          value: 'review',
          checked: false,
          group: 'custom',
          subGroup: '(ungrouped)',
          suffix: undefined,
        },
        {
          name: 'commit',
          description: 'Commit skill',
          value: 'commit',
          checked: true,
          group: 'official',
          subGroup: 'anthropic/skills',
          suffix: '[deployed]',
        },
      ],
      pageSize: 15,
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
        subGroup: '(ungrouped)',
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./interactive-select.js', () => ({
  interactiveCheckbox: vi.fn().mockResolvedValue([]),
}));

import { promptSkills, promptSkillsToUninstall, resolveTargetAgents } from './prompts.js';
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
          checked: false,
          group: 'official',
          subGroup: 'anthropic/skills',
        },
        {
          name: 'my-skill',
          description: 'Community skill',
          value: '/skills/community/owner/repo/my-skill',
          checked: false,
          group: 'community',
          subGroup: 'owner/repo',
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
          path: '/skills/custom/tools/review',
          source: 'custom/tools',
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
        },
        {
          name: 'review',
          description: 'Review skill',
          value: 'review',
          checked: false,
          group: 'custom',
          subGroup: 'tools',
          suffix: undefined,
        },
      ],
      pageSize: 15,
    });
  });
});

describe('resolveTargetAgents', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interactiveCheckbox).mockResolvedValue([]);
  });

  it('parses single agent from -a flag', async () => {
    const result = await resolveTargetAgents(
      { agent: 'claude-code' },
      () => [] as ToolName[],
    );
    expect(result).toEqual(['claude-code']);
  });

  it('parses multiple comma-separated agents from -a flag', async () => {
    const result = await resolveTargetAgents(
      { agent: 'claude-code,cursor' },
      () => [] as ToolName[],
    );
    expect(result).toEqual(['claude-code', 'cursor']);
  });

  it('exits on invalid agent name', async () => {
    await resolveTargetAgents(
      { agent: 'invalid-name' },
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

  it('exits when -a and -s used together', async () => {
    await resolveTargetAgents(
      { agent: 'claude-code', sameAgents: true },
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
});

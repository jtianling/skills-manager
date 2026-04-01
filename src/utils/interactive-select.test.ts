import { describe, it, expect } from 'vitest';
import {
  buildDisplayItems,
  getDisplayIndexForLineNumber,
  getGroupState,
  SelectChoice,
} from './interactive-select.js';

describe('buildDisplayItems', () => {
  it('builds flat items without subGroup (backward compatible)', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'g1' },
      { name: 'b', value: 'b', group: 'g1' },
    ];
    const { displayItems, filteredIndices } = buildDisplayItems(choices, '');

    expect(filteredIndices).toEqual([0, 1]);
    expect(displayItems).toEqual([
      { type: 'separator', text: '── g1 ──' },
      { type: 'choice', choiceIndex: 0 },
      { type: 'choice', choiceIndex: 1 },
    ]);
  });

  it('inserts group-header when subGroup is present', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'official', subGroup: 'anthropic' },
      { name: 'b', value: 'b', group: 'official', subGroup: 'anthropic' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    expect(displayItems[0]).toEqual({ type: 'separator', text: '── official ──' });
    expect(displayItems[1].type).toBe('group-header');
    expect(displayItems[1].subGroupName).toBe('anthropic');
    expect(displayItems[1].childIndices).toEqual([0, 1]);
    expect(displayItems[2]).toEqual({ type: 'choice', choiceIndex: 0 });
    expect(displayItems[3]).toEqual({ type: 'choice', choiceIndex: 1 });
  });

  it('creates separate group-headers for different subGroups', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'community', subGroup: 'obra/x' },
      { name: 'b', value: 'b', group: 'community', subGroup: 'obra/y' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const groupHeaders = displayItems.filter((d) => d.type === 'group-header');
    expect(groupHeaders).toHaveLength(2);
    expect(groupHeaders[0].subGroupName).toBe('obra/x');
    expect(groupHeaders[0].childIndices).toEqual([0]);
    expect(groupHeaders[1].subGroupName).toBe('obra/y');
    expect(groupHeaders[1].childIndices).toEqual([1]);
  });

  it('handles mixed grouped and ungrouped choices in same category', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'custom', subGroup: 'tools' },
      { name: 'b', value: 'b', group: 'custom' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    expect(displayItems[0]).toEqual({ type: 'separator', text: '── custom ──' });
    expect(displayItems[1].type).toBe('group-header');
    expect(displayItems[1].childIndices).toEqual([0]);
    expect(displayItems[2]).toEqual({ type: 'choice', choiceIndex: 0 });
    expect(displayItems[3]).toEqual({ type: 'choice', choiceIndex: 1 });
  });

  it('hides group-header when all children are filtered by search', () => {
    const choices: SelectChoice[] = [
      { name: 'alpha', value: 'alpha', group: 'g', subGroup: 'sg1' },
      { name: 'beta', value: 'beta', group: 'g', subGroup: 'sg2' },
    ];
    const { displayItems } = buildDisplayItems(choices, 'beta');

    const groupHeaders = displayItems.filter((d) => d.type === 'group-header');
    expect(groupHeaders).toHaveLength(1);
    expect(groupHeaders[0].subGroupName).toBe('sg2');
    expect(groupHeaders[0].childIndices).toEqual([1]);
  });

  it('updates childIndices when some children are filtered', () => {
    const choices: SelectChoice[] = [
      { name: 'alpha', value: 'alpha', group: 'g', subGroup: 'sg' },
      { name: 'bravo', value: 'bravo', group: 'g', subGroup: 'sg' },
      { name: 'apex', value: 'apex', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, 'al');

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(groupHeader.childIndices).toEqual([0]);
  });

  it('skips subgroup children when subgroup is collapsed', () => {
    const choices: SelectChoice[] = [
      { name: 'alpha', value: 'alpha', group: 'g', subGroup: 'sg' },
      { name: 'bravo', value: 'bravo', group: 'g', subGroup: 'sg' },
      { name: 'charlie', value: 'charlie', group: 'g' },
    ];
    const { displayItems, filteredIndices } = buildDisplayItems(choices, '', new Set(['sg']));

    expect(filteredIndices).toEqual([0, 1, 2]);
    expect(displayItems).toEqual([
      { type: 'separator', text: '── g ──' },
      { type: 'group-header', subGroupName: 'sg', childIndices: [0, 1] },
      { type: 'choice', choiceIndex: 2 },
    ]);
  });

  it('keeps group-header childIndices complete while collapsed', () => {
    const choices: SelectChoice[] = [
      { name: 'alpha', value: 'alpha', group: 'g', subGroup: 'sg' },
      { name: 'bravo', value: 'bravo', group: 'g', subGroup: 'sg' },
      { name: 'charlie', value: 'charlie', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '', new Set(['sg']));

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(groupHeader.childIndices).toEqual([0, 1, 2]);
    expect(displayItems.filter((d) => d.type === 'choice')).toEqual([]);
  });

  it('renders empty group header with zero children for placeholder choices', () => {
    const choices: SelectChoice[] = [
      { name: '(empty)', value: '__empty_unused', locked: true, subGroup: 'unused' },
      { name: 'alpha', value: 'alpha', group: 'custom', subGroup: 'dev' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const headers = displayItems.filter((d) => d.type === 'group-header');
    expect(headers).toHaveLength(2);

    const unusedHeader = headers.find((h) => h.subGroupName === 'unused')!;
    expect(unusedHeader.childIndices).toEqual([]);

    const devHeader = headers.find((h) => h.subGroupName === 'dev')!;
    expect(devHeader.childIndices).toEqual([1]);

    const choiceItems = displayItems.filter((d) => d.type === 'choice');
    expect(choiceItems).toHaveLength(1);
    expect(choiceItems[0].choiceIndex).toBe(1);
  });

  it('builds nested inner-group headers inside subgroup', () => {
    const choices: SelectChoice[] = [
      {
        name: 'commit',
        value: 'commit',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      {
        name: 'review',
        value: 'review',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      {
        name: 'lint',
        value: 'lint',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'mattpocock/skills',
      },
      {
        name: 'local-tool',
        value: 'local-tool',
        group: 'custom',
        subGroup: 'python',
      },
    ];

    const { displayItems, filteredIndices } = buildDisplayItems(choices, '');

    expect(filteredIndices).toEqual([0, 1, 2, 3]);
    expect(displayItems).toEqual([
      { type: 'separator', text: '── custom ──' },
      { type: 'group-header', subGroupName: 'python', childIndices: [0, 1, 2, 3] },
      {
        type: 'inner-group-header',
        parentSubGroup: 'python',
        innerGroupName: 'anthropic/skills',
        childIndices: [0, 1],
      },
      { type: 'choice', choiceIndex: 0 },
      { type: 'choice', choiceIndex: 1 },
      {
        type: 'inner-group-header',
        parentSubGroup: 'python',
        innerGroupName: 'mattpocock/skills',
        childIndices: [2],
      },
      { type: 'choice', choiceIndex: 2 },
      { type: 'choice', choiceIndex: 3 },
    ]);
  });

  it('merges non-contiguous same-innerGroup choices into one header', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    ];

    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeaders = displayItems.filter((d) => d.type === 'inner-group-header');
    expect(innerHeaders).toHaveLength(1);
    expect(innerHeaders[0].innerGroupName).toBe('anthropic/skills');
    expect(innerHeaders[0].childIndices).toEqual([0, 2]);

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(groupHeader.childIndices).toEqual([0, 2, 1]);
  });

  it('hides only inner-group choices when inner group is collapsed', () => {
    const choices: SelectChoice[] = [
      {
        name: 'commit',
        value: 'commit',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      {
        name: 'review',
        value: 'review',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      { name: 'local-tool', value: 'local-tool', group: 'custom', subGroup: 'python' },
    ];

    const { displayItems } = buildDisplayItems(
      choices,
      '',
      new Set<string>(),
      new Set(['python/anthropic/skills']),
    );

    expect(displayItems).toEqual([
      { type: 'separator', text: '── custom ──' },
      { type: 'group-header', subGroupName: 'python', childIndices: [0, 1, 2] },
      {
        type: 'inner-group-header',
        parentSubGroup: 'python',
        innerGroupName: 'anthropic/skills',
        childIndices: [0, 1],
      },
      { type: 'choice', choiceIndex: 2 },
    ]);
  });

  it('hides inner-group headers and choices when outer subgroup is collapsed', () => {
    const choices: SelectChoice[] = [
      {
        name: 'commit',
        value: 'commit',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      { name: 'local-tool', value: 'local-tool', group: 'custom', subGroup: 'python' },
    ];

    const { displayItems } = buildDisplayItems(
      choices,
      '',
      new Set(['python']),
      new Set(['python/anthropic/skills']),
    );

    expect(displayItems).toEqual([
      { type: 'separator', text: '── custom ──' },
      { type: 'group-header', subGroupName: 'python', childIndices: [0, 1] },
    ]);
  });
});

describe('group-header batch toggle logic', () => {
  it('toggles none->all: selects all children', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'g', subGroup: 'sg' },
      { name: 'b', value: 'b', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>();

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    const state = getGroupState(groupHeader.childIndices!, selected);
    expect(state).toBe('none');

    groupHeader.childIndices!.forEach((idx) => selected.add(idx));
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('all');
  });

  it('toggles partial->all: selects remaining children', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'g', subGroup: 'sg' },
      { name: 'b', value: 'b', group: 'g', subGroup: 'sg' },
      { name: 'c', value: 'c', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>([0]);

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('partial');

    groupHeader.childIndices!.forEach((idx) => selected.add(idx));
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('all');
  });

  it('toggles all->none: deselects all children', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'g', subGroup: 'sg' },
      { name: 'b', value: 'b', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>([0, 1]);

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('all');

    groupHeader.childIndices!.forEach((idx) => selected.delete(idx));
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('none');
  });
});

describe('search filter state decoupling', () => {
  const choices: SelectChoice[] = [
    { name: 'alpha', value: 'alpha', group: 'g1' },
    { name: 'beta', value: 'beta', group: 'g1' },
    { name: 'gamma', value: 'gamma', group: 'g2' },
  ];

  it('shows all items when isFiltered is false (empty query passed)', () => {
    const { filteredIndices } = buildDisplayItems(choices, '');
    expect(filteredIndices).toEqual([0, 1, 2]);
  });

  it('filters items when isFiltered is true (query passed)', () => {
    const { filteredIndices } = buildDisplayItems(choices, 'alpha');
    expect(filteredIndices).toEqual([0]);
  });

  it('Esc behavior: passing empty string restores full list even with searchQuery preserved', () => {
    const { filteredIndices: filtered } = buildDisplayItems(choices, 'alpha');
    expect(filtered).toEqual([0]);

    const { filteredIndices: restored } = buildDisplayItems(choices, '');
    expect(restored).toEqual([0, 1, 2]);
  });

  it('Enter behavior: passing query preserves filter after exiting search mode', () => {
    const { filteredIndices } = buildDisplayItems(choices, 'beta');
    expect(filteredIndices).toEqual([1]);

    const { filteredIndices: stillFiltered } = buildDisplayItems(choices, 'beta');
    expect(stillFiltered).toEqual([1]);
  });

  it('re-entering search after Esc can reactivate filter with same query', () => {
    const { filteredIndices: restored } = buildDisplayItems(choices, '');
    expect(restored).toEqual([0, 1, 2]);

    const { filteredIndices: refiltered } = buildDisplayItems(choices, 'gamma');
    expect(refiltered).toEqual([2]);
  });
});

describe('getGroupState', () => {
  it('returns none for empty childIndices', () => {
    expect(getGroupState([], new Set())).toBe('none');
  });

  it('returns none when no children selected', () => {
    expect(getGroupState([0, 1, 2], new Set())).toBe('none');
  });

  it('returns all when all children selected', () => {
    expect(getGroupState([0, 1, 2], new Set([0, 1, 2]))).toBe('all');
  });

  it('returns partial when some children selected', () => {
    expect(getGroupState([0, 1, 2], new Set([0, 2]))).toBe('partial');
  });

  it('ignores unrelated selected indices', () => {
    expect(getGroupState([0, 1], new Set([0, 1, 5, 10]))).toBe('all');
  });

  it('uses all collapsed children when calculating state', () => {
    const choices: SelectChoice[] = [
      { name: 'alpha', value: 'alpha', group: 'g', subGroup: 'sg' },
      { name: 'bravo', value: 'bravo', group: 'g', subGroup: 'sg' },
      { name: 'charlie', value: 'charlie', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '', new Set(['sg']));
    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;

    expect(getGroupState(groupHeader.childIndices!, new Set([0, 2]))).toBe('partial');
    expect(getGroupState(groupHeader.childIndices!, new Set([0, 1, 2]))).toBe('all');
  });
});

describe('getDisplayIndexForLineNumber', () => {
  it('counts all focusable items and skips separators', () => {
    const choices: SelectChoice[] = [
      {
        name: 'commit',
        value: 'commit',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      { name: 'local-tool', value: 'local-tool', group: 'custom', subGroup: 'python' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    expect(getDisplayIndexForLineNumber(displayItems, 1)).toBe(1);
    expect(getDisplayIndexForLineNumber(displayItems, 2)).toBe(2);
    expect(getDisplayIndexForLineNumber(displayItems, 3)).toBe(3);
    expect(getDisplayIndexForLineNumber(displayItems, 4)).toBe(4);
  });

  it('ignores hidden items when groups are collapsed', () => {
    const choices: SelectChoice[] = [
      {
        name: 'commit',
        value: 'commit',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      {
        name: 'review',
        value: 'review',
        group: 'custom',
        subGroup: 'python',
        innerGroup: 'anthropic/skills',
      },
      { name: 'local-tool', value: 'local-tool', group: 'custom', subGroup: 'python' },
    ];
    const { displayItems } = buildDisplayItems(
      choices,
      '',
      new Set<string>(),
      new Set(['python/anthropic/skills']),
    );

    expect(getDisplayIndexForLineNumber(displayItems, 1)).toBe(1);
    expect(getDisplayIndexForLineNumber(displayItems, 2)).toBe(2);
    expect(getDisplayIndexForLineNumber(displayItems, 3)).toBe(3);
    expect(getDisplayIndexForLineNumber(displayItems, 4)).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';
import { buildDisplayItems, getGroupState, SelectChoice } from './interactive-select.js';

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
});

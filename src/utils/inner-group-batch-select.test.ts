import { describe, it, expect } from 'vitest';
import { buildDisplayItems, getGroupState, SelectChoice } from './interactive-select.js';

describe('inner-group-header batch select', () => {
  const choices: SelectChoice[] = [
    { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
    { name: 'my-formatter', value: 'my-formatter', group: 'custom', subGroup: 'python' },
  ];

  it('space on inner-group-header selects all inner children (none -> all)', () => {
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>();

    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(innerHeader.childIndices).toEqual([0, 1]);

    const state = getGroupState(innerHeader.childIndices!, selected);
    expect(state).toBe('none');

    // Simulate space: select all children
    innerHeader.childIndices!.forEach((idx) => selected.add(idx));
    expect(getGroupState(innerHeader.childIndices!, selected)).toBe('all');
    expect(selected.has(0)).toBe(true);
    expect(selected.has(1)).toBe(true);
    // Direct children should NOT be affected
    expect(selected.has(2)).toBe(false);
    expect(selected.has(3)).toBe(false);
  });

  it('space on inner-group-header deselects all inner children (all -> none)', () => {
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>([0, 1]);

    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(getGroupState(innerHeader.childIndices!, selected)).toBe('all');

    innerHeader.childIndices!.forEach((idx) => selected.delete(idx));
    expect(getGroupState(innerHeader.childIndices!, selected)).toBe('none');
  });

  it('space on inner-group-header with partial selection selects all (partial -> all)', () => {
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>([0]); // only commit selected

    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(getGroupState(innerHeader.childIndices!, selected)).toBe('partial');

    // Simulate space: partial -> all
    innerHeader.childIndices!.forEach((idx) => selected.add(idx));
    expect(getGroupState(innerHeader.childIndices!, selected)).toBe('all');
  });
});

describe('outer group-header batch select includes inner group children', () => {
  const choices: SelectChoice[] = [
    { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
    { name: 'my-formatter', value: 'my-formatter', group: 'custom', subGroup: 'python' },
  ];

  it('outer group-header childIndices includes both inner and direct children', () => {
    const { displayItems } = buildDisplayItems(choices, '');

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    // Should include all 4 choices: inner group (0, 1) + direct (2, 3)
    expect(groupHeader.childIndices).toEqual([0, 1, 2, 3]);
  });

  it('space on outer group-header selects all children including inner group', () => {
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>();

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    groupHeader.childIndices!.forEach((idx) => selected.add(idx));

    expect(selected.size).toBe(4);
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('all');
  });

  it('outer group-header shows partial when only inner group children selected', () => {
    const { displayItems } = buildDisplayItems(choices, '');
    const selected = new Set<number>([0, 1]); // only inner group children

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(getGroupState(groupHeader.childIndices!, selected)).toBe('partial');
  });
});

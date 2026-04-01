import { describe, it, expect } from 'vitest';
import { buildDisplayItems, SelectChoice } from './interactive-select.js';

describe('inner group folding', () => {
  const choices: SelectChoice[] = [
    { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
    { name: 'ungrouped', value: 'ungrouped', group: 'custom' },
  ];

  it('outer collapse hides all inner headers and choices', () => {
    const collapsed = new Set(['python']);
    const { displayItems } = buildDisplayItems(choices, '', collapsed);

    const types = displayItems.map((d) => d.type);
    // Only separator + collapsed group-header + ungrouped choice should remain
    expect(types).toEqual([
      'separator',
      'group-header',
      'choice', // ungrouped
    ]);

    // Collapsed group-header should still have all childIndices
    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    expect(groupHeader.childIndices).toEqual([0, 1, 2]);
  });

  it('inner collapse hides only inner group choices', () => {
    // innerCollapsed uses composite key: subGroup/innerGroup
    const innerCollapsed = new Set<string>();
    const collapsed = new Set<string>();
    // Pass innerCollapsed as 4th argument (to be implemented)
    const { displayItems } = buildDisplayItems(choices, '', collapsed, innerCollapsed);

    // With nothing collapsed, all items visible
    const allTypes = displayItems.map((d) => d.type);
    expect(allTypes).toContain('inner-group-header');
    expect(allTypes.filter((t) => t === 'choice')).toHaveLength(4);

    // Now collapse inner group
    const innerCollapsed2 = new Set(['python/anthropic/skills']);
    const { displayItems: items2 } = buildDisplayItems(choices, '', collapsed, innerCollapsed2);

    const types2 = items2.map((d) => d.type);
    // inner-group-header still visible, but its 2 choices hidden
    expect(types2).toContain('inner-group-header');
    expect(types2.filter((t) => t === 'choice')).toHaveLength(2); // my-linter + ungrouped
  });

  it('outer expand restores inner headers with their fold state preserved', () => {
    // First collapse inner, then collapse outer, then expand outer
    const innerCollapsed = new Set(['python/anthropic/skills']);
    const collapsed = new Set<string>();
    const { displayItems } = buildDisplayItems(choices, '', collapsed, innerCollapsed);

    // Inner header visible but its children hidden
    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(innerHeader).toBeDefined();
    // Only my-linter and ungrouped choices visible (inner group choices hidden)
    const visibleChoices = displayItems.filter((d) => d.type === 'choice');
    expect(visibleChoices).toHaveLength(2);
  });

  it('default state: all headers expanded', () => {
    const { displayItems } = buildDisplayItems(choices, '');

    const types = displayItems.map((d) => d.type);
    expect(types).toEqual([
      'separator',
      'group-header',
      'inner-group-header',
      'choice', // commit
      'choice', // review
      'choice', // my-linter
      'choice', // ungrouped
    ]);
  });
});

describe('fold line number recalculation', () => {
  const choices: SelectChoice[] = [
    { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
    { name: 'ungrouped', value: 'ungrouped', group: 'custom' },
  ];

  it('outer fold: hidden items do not consume line numbers', () => {
    const collapsed = new Set(['python']);
    const { displayItems } = buildDisplayItems(choices, '', collapsed);

    // Only group-header(python) + choice(ungrouped) are focusable
    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    expect(focusable).toHaveLength(2);
    // Line 1: python (group-header), Line 2: ungrouped (choice)
    expect(focusable[0].type).toBe('group-header');
    expect(focusable[1].type).toBe('choice');
  });

  it('inner fold: hidden choices do not consume line numbers', () => {
    const innerCollapsed = new Set(['python/anthropic/skills']);
    const { displayItems } = buildDisplayItems(choices, '', new Set(), innerCollapsed);

    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    // Line 1: python, Line 2: anthropic/skills (inner header), Line 3: my-linter, Line 4: ungrouped
    expect(focusable).toHaveLength(4);
    expect(focusable[0].type).toBe('group-header');
    expect(focusable[1].type).toBe('inner-group-header');
    expect(focusable[2].type).toBe('choice');
    expect(focusable[3].type).toBe('choice');
  });

  it('c key: all collapsed leaves only top-level group-headers and ungrouped choices', () => {
    const collapsed = new Set(['python']);
    const innerCollapsed = new Set(['python/anthropic/skills']);
    const { displayItems } = buildDisplayItems(choices, '', collapsed, innerCollapsed);

    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    // python (collapsed) + ungrouped
    expect(focusable).toHaveLength(2);
  });
});

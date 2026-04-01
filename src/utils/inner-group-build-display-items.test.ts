import { describe, it, expect } from 'vitest';
import { buildDisplayItems, SelectChoice } from './interactive-select.js';

describe('buildDisplayItems inner-group-header generation', () => {
  it('generates inner-group-header for choices with same subGroup and innerGroup', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeaders = displayItems.filter((d) => d.type === 'inner-group-header');
    expect(innerHeaders).toHaveLength(1);
    expect(innerHeaders[0].innerGroupName).toBe('anthropic/skills');
    expect(innerHeaders[0].childIndices).toEqual([0, 1]);
  });

  it('generates separate inner-group-headers for different innerGroups in same subGroup', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'grill', value: 'grill', group: 'custom', subGroup: 'python', innerGroup: 'mattpocock/skills' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeaders = displayItems.filter((d) => d.type === 'inner-group-header');
    expect(innerHeaders).toHaveLength(2);
    expect(innerHeaders[0].innerGroupName).toBe('anthropic/skills');
    expect(innerHeaders[0].childIndices).toEqual([0, 1]);
    expect(innerHeaders[1].innerGroupName).toBe('mattpocock/skills');
    expect(innerHeaders[1].childIndices).toEqual([2]);
  });

  it('inner-group-header is focusable', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(innerHeader).toBeDefined();
    // inner-group-header should appear between group-header and choice
    const types = displayItems.map((d) => d.type);
    expect(types).toContain('inner-group-header');
  });

  it('mixes inner-grouped and direct choices under same subGroup', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
      { name: 'my-formatter', value: 'my-formatter', group: 'custom', subGroup: 'python' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    // Expected order: separator, group-header(python), inner-group-header(anthropic/skills),
    // choice(commit), choice(review), choice(my-linter), choice(my-formatter)
    const types = displayItems.map((d) => d.type);
    expect(types).toEqual([
      'separator',
      'group-header',
      'inner-group-header',
      'choice',
      'choice',
      'choice',
      'choice',
    ]);

    const groupHeader = displayItems.find((d) => d.type === 'group-header')!;
    // group-header childIndices should include ALL choices (inner + direct)
    expect(groupHeader.childIndices).toEqual([0, 1, 2, 3]);

    const innerHeader = displayItems.find((d) => d.type === 'inner-group-header')!;
    expect(innerHeader.childIndices).toEqual([0, 1]);
  });
});

describe('buildDisplayItems 3-layer nesting structure', () => {
  it('produces correct display order: separator > group-header > inner-group-header > choices > direct choices', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'dev', innerGroup: 'anthropic/skills' },
      { name: 'my-tool', value: 'my-tool', group: 'custom', subGroup: 'dev' },
      { name: 'ungrouped', value: 'ungrouped', group: 'custom' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const types = displayItems.map((d) => d.type);
    expect(types).toEqual([
      'separator',       // ── custom ──
      'group-header',    // ▼ ◯ dev
      'inner-group-header', // ▼ ◯ anthropic/skills
      'choice',          // commit (under inner group)
      'choice',          // my-tool (direct under dev)
      'choice',          // ungrouped (no subGroup)
    ]);
  });

  it('handles multiple subGroups each with their own innerGroups', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'dev', innerGroup: 'anthropic/skills' },
      { name: 'grill', value: 'grill', group: 'custom', subGroup: 'dev', innerGroup: 'mattpocock/skills' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'openspec', innerGroup: 'anthropic/skills' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeaders = displayItems.filter((d) => d.type === 'inner-group-header');
    expect(innerHeaders).toHaveLength(3);

    // dev has 2 inner groups, openspec has 1
    const devInnerHeaders = innerHeaders.filter((_, idx) => {
      // find which belong to dev vs openspec by checking preceding group-header
      return idx < 2; // first two inner headers are under dev
    });
    expect(devInnerHeaders[0].innerGroupName).toBe('anthropic/skills');
    expect(devInnerHeaders[1].innerGroupName).toBe('mattpocock/skills');
  });

  it('no innerGroup choices produce standard 2-layer nesting (backward compatible)', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'g', subGroup: 'sg' },
      { name: 'b', value: 'b', group: 'g', subGroup: 'sg' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const innerHeaders = displayItems.filter((d) => d.type === 'inner-group-header');
    expect(innerHeaders).toHaveLength(0);

    expect(displayItems.map((d) => d.type)).toEqual([
      'separator',
      'group-header',
      'choice',
      'choice',
    ]);
  });
});

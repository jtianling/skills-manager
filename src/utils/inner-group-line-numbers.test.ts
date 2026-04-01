import { describe, it, expect } from 'vitest';
import { buildDisplayItems, SelectChoice } from './interactive-select.js';

/**
 * Line numbers are assigned to all focusable items (choice, group-header, inner-group-header).
 * Separators do not get line numbers.
 * This test verifies the data model supports correct line number assignment.
 */
describe('line number assignment to focusable items', () => {
  it('group-header is focusable and should receive a line number', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'custom', subGroup: 'dev' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    // group-header + choice = 2 focusable items
    expect(focusable).toHaveLength(2);
    expect(focusable[0].type).toBe('group-header');
    expect(focusable[1].type).toBe('choice');
  });

  it('inner-group-header is focusable and should receive a line number', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'dev', innerGroup: 'anthropic/skills' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    // group-header + inner-group-header + choice = 3 focusable items
    expect(focusable).toHaveLength(3);
    expect(focusable[0].type).toBe('group-header');
    expect(focusable[1].type).toBe('inner-group-header');
    expect(focusable[2].type).toBe('choice');
  });

  it('separator is not focusable and should not receive a line number', () => {
    const choices: SelectChoice[] = [
      { name: 'a', value: 'a', group: 'custom', subGroup: 'dev' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    const separator = displayItems.find((d) => d.type === 'separator')!;
    expect(separator).toBeDefined();
    // separator should not be counted in focusable items
    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    expect(focusable.every((d) => d.type !== 'separator')).toBe(true);
  });

  it('line numbers are continuous across mixed item types', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'review', value: 'review', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
      { name: 'ungrouped', value: 'ungrouped', group: 'custom' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    // Expected focusable order (line numbers 1-6):
    // 1: group-header (python)
    // 2: inner-group-header (anthropic/skills)
    // 3: choice (commit)
    // 4: choice (review)
    // 5: choice (my-linter)
    // 6: choice (ungrouped)
    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    expect(focusable).toHaveLength(6);
    expect(focusable.map((d) => d.type)).toEqual([
      'group-header',
      'inner-group-header',
      'choice',
      'choice',
      'choice',
      'choice',
    ]);
  });

  it('jumpToLineNumber targets focusable items including headers', () => {
    const choices: SelectChoice[] = [
      { name: 'commit', value: 'commit', group: 'custom', subGroup: 'python', innerGroup: 'anthropic/skills' },
      { name: 'my-linter', value: 'my-linter', group: 'custom', subGroup: 'python' },
    ];
    const { displayItems } = buildDisplayItems(choices, '');

    // Line 1 = group-header(python), Line 2 = inner-group-header(anthropic/skills),
    // Line 3 = choice(commit), Line 4 = choice(my-linter)
    const focusable = displayItems.filter(
      (d) => d.type === 'choice' || d.type === 'group-header' || d.type === 'inner-group-header'
    );
    expect(focusable).toHaveLength(4);

    // Verify line 2 (index 1 in focusable array) is the inner-group-header
    expect(focusable[1].type).toBe('inner-group-header');
    expect(focusable[1].innerGroupName).toBe('anthropic/skills');
  });
});

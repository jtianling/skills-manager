import { describe, it, expect } from 'vitest';
import {
  buildVirtualGroupChoices,
  buildSourceGroupedChoices,
} from './prompts.js';

describe('buildVirtualGroupChoices innerGroup nesting', () => {
  it('official skill in virtual group gets innerGroup instead of source suffix', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commit = choices.find((c) => c.name === 'commit')!;
    expect(commit.innerGroup).toBe('anthropic/skills');
    expect(commit.suffix).toBeUndefined();
    expect(commit.subGroup).toBe('dev');

    const myTool = choices.find((c) => c.name === 'my-tool')!;
    expect(myTool.innerGroup).toBeUndefined();
    expect(myTool.subGroup).toBe('dev');
  });

  it('community skill in virtual group gets innerGroup', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'linter', source: 'community/bob/cool-tools', description: 'Linter' },
      ],
      { dev: ['community/bob/cool-tools/linter'] },
    );

    const linter = choices.find((c) => c.name === 'linter')!;
    expect(linter.innerGroup).toBe('bob/cool-tools');
    expect(linter.suffix).toBeUndefined();
  });

  it('flat custom skill in virtual group does NOT get innerGroup', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'my-linter', source: 'custom', description: 'My linter' },
      ],
      { dev: ['custom/my-linter'] },
    );

    const myLinter = choices.find((c) => c.name === 'my-linter')!;
    expect(myLinter.innerGroup).toBeUndefined();
    expect(myLinter.subGroup).toBe('dev');
  });

  it('custom sub-path skill in virtual group gets innerGroup', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      { develop: ['custom/openspec/openspec-apply'] },
    );

    const apply = choices.find((c) => c.name === 'openspec-apply')!;
    expect(apply.innerGroup).toBe('openspec');
    expect(apply.subGroup).toBe('develop');
  });

  it('custom/openspec skill has innerGroup in develop group but not in openspec group', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'openspec-apply', source: 'custom/openspec', description: 'Apply' },
      ],
      {
        develop: ['custom/openspec/openspec-apply'],
        openspec: ['custom/openspec/openspec-apply'],
      },
    );

    const inDevelop = choices.find((c) => c.subGroup === 'develop')!;
    expect(inDevelop.innerGroup).toBe('openspec');

    const inOpenspec = choices.find((c) => c.subGroup === 'openspec')!;
    expect(inOpenspec.innerGroup).toBeUndefined();
  });

  it('functional suffix preserved without source suffix', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
      { getSuffix: () => '[deployed]' },
    );

    const commit = choices[0];
    expect(commit.suffix).toBe('[deployed]');
    expect(commit.innerGroup).toBe('anthropic/skills');
    // Should NOT contain source in suffix
    expect(commit.suffix).not.toContain('anthropic/skills');
  });

  it('always nests even with single source in virtual group', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
      ],
      { python: ['official/anthropic/skills/commit', 'official/anthropic/skills/review'] },
    );

    expect(choices.filter((c) => c.innerGroup === 'anthropic/skills')).toHaveLength(2);
  });

  it('ungrouped skills do NOT get innerGroup', () => {
    const choices = buildVirtualGroupChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'review', source: 'official/anthropic/skills', description: 'Review' },
      ],
      { dev: ['official/anthropic/skills/commit'] },
    );

    const review = choices.find((c) => c.name === 'review')!;
    expect(review.subGroup).toBeUndefined();
    expect(review.innerGroup).toBeUndefined();
  });
});

describe('buildSourceGroupedChoices innerGroup nesting', () => {
  it('official skill in virtual group gets innerGroup, in source group does not', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['official/anthropic/skills/commit', 'custom/my-tool'] },
    );

    const commitChoices = choices.filter((c) => c.name === 'commit');
    expect(commitChoices).toHaveLength(2);

    const commitOfficial = commitChoices.find((c) => c.group === 'official')!;
    expect(commitOfficial.subGroup).toBe('anthropic/skills');
    expect(commitOfficial.innerGroup).toBeUndefined();

    const commitVg = commitChoices.find((c) => c.subGroup === 'dev')!;
    expect(commitVg.innerGroup).toBe('anthropic/skills');
    expect(commitVg.suffix).toBeUndefined(); // no source suffix
  });

  it('custom skill in virtual group has no innerGroup', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['custom/my-tool'] },
    );

    const myTool = choices.find((c) => c.subGroup === 'dev')!;
    expect(myTool.innerGroup).toBeUndefined();
  });

  it('empty virtual group still shows header', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      { dev: ['custom/my-tool'], 'empty-group': [] },
    );

    const emptyChoice = choices.find((c) => c.subGroup === 'empty-group')!;
    expect(emptyChoice.name).toBe('(empty)');
    expect(emptyChoice.locked).toBe(true);
  });

  it('no virtual groups: behavior unchanged, no innerGroup', () => {
    const choices = buildSourceGroupedChoices(
      [
        { name: 'commit', source: 'official/anthropic/skills', description: 'Commit' },
        { name: 'my-tool', source: 'custom', description: 'My tool' },
      ],
      {},
    );

    for (const choice of choices) {
      expect(choice.innerGroup).toBeUndefined();
    }
  });
});

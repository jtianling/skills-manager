import { interactiveCheckbox, type SelectChoice } from '../../src/utils/interactive-select.ts';

const choices: SelectChoice[] = [
  {
    name: 'skill-x',
    value: 'custom/skill-x',
    description: 'shared skill',
    group: 'custom',
    subGroup: 'group-a',
  },
  {
    name: 'unique-a',
    value: 'custom/unique-a',
    description: 'only in group-a',
    group: 'custom',
    subGroup: 'group-a',
  },
  {
    name: 'skill-x',
    value: 'custom/skill-x',
    description: 'shared skill (clone)',
    group: 'custom',
    subGroup: 'group-b',
  },
  {
    name: 'unique-b',
    value: 'custom/unique-b',
    description: 'only in group-b',
    group: 'custom',
    subGroup: 'group-b',
  },
];

const result = await interactiveCheckbox({
  message: 'Select skills:',
  choices,
  pageSize: 12,
  searchThreshold: 100,
});

console.log(`RESULT:${JSON.stringify(result)}`);

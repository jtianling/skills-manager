import { interactiveCheckbox, type SelectChoice } from '../../src/utils/interactive-select.ts';

const choices: SelectChoice[] = [
  {
    name: 'alpha-one',
    value: 'alpha-one',
    description: 'alpha one description',
    group: 'official',
    subGroup: 'repo-a',
  },
  {
    name: 'alpha-two',
    value: 'alpha-two',
    description: 'alpha two description',
    group: 'official',
    subGroup: 'repo-a',
  },
  {
    name: 'beta-one',
    value: 'beta-one',
    description: 'beta one description',
    group: 'official',
    subGroup: 'repo-b',
  },
  {
    name: 'beta-two',
    value: 'beta-two',
    description: 'beta two description',
    group: 'official',
    subGroup: 'repo-b',
  },
];

const result = await interactiveCheckbox({
  message: 'Select skills to install:',
  choices,
  pageSize: 12,
  searchThreshold: 1,
});

console.log(`RESULT:${JSON.stringify(result)}`);

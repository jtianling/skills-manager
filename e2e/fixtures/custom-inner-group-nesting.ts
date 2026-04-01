import { interactiveCheckbox } from '../../src/utils/interactive-select.ts';
import { buildVirtualGroupChoices, type VirtualGroupsData } from '../../src/utils/prompts.ts';

const skills = [
  { name: 'os-apply', source: 'custom/openspec', description: 'apply change' },
  { name: 'os-verify', source: 'custom/openspec', description: 'verify change' },
  { name: 'grill-me', source: 'community/mattpocock/skills', description: 'grill' },
  { name: 'tdd', source: 'community/mattpocock/skills', description: 'test driven' },
  { name: 'my-linter', source: 'custom', description: 'flat custom' },
];

const groupsData: VirtualGroupsData = {
  develop: [
    'custom/openspec/os-apply',
    'custom/openspec/os-verify',
    'community/mattpocock/skills/grill-me',
    'community/mattpocock/skills/tdd',
    'custom/my-linter',
  ],
  openspec: [
    'custom/openspec/os-apply',
    'custom/openspec/os-verify',
  ],
};

const choices = buildVirtualGroupChoices(skills, groupsData);

const result = await interactiveCheckbox({
  message: 'Select skills:',
  choices,
  pageSize: 20,
  searchThreshold: 100,
});

console.log(`RESULT:${JSON.stringify(result)}`);

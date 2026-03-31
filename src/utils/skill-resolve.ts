import { SkillInfo } from '../types.js';
import { promptSelect } from './prompts.js';

export async function resolveSkillByName(
  name: string,
  allSkills: SkillInfo[],
): Promise<SkillInfo | null> {
  const fullKeyMatch = allSkills.find(
    (s) => `${s.source}/${s.name}` === name,
  );
  if (fullKeyMatch) {
    return fullKeyMatch;
  }

  const matches = allSkills.filter((s) => s.name === name);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  console.log(`Multiple skills found for '${name}':`);
  const choices = matches.map((s) => ({
    name: `${s.source}/${s.name}`,
    value: `${s.source}/${s.name}`,
  }));
  const selectedKey = await promptSelect('Which one?', choices);
  const resolved = matches.find((s) => `${s.source}/${s.name}` === selectedKey);
  return resolved ?? null;
}

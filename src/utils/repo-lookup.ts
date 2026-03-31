import { findOfficialProvider } from '../constants.js';
import { SkillsService } from '../services/skills.js';
import { SkillInfo } from '../types.js';
import { detectSourceType, extractOwnerRepo } from './source-detection.js';

export type ArgFormat = 'owner-repo' | 'skill-name' | 'install-source';

export function detectArgFormat(arg: string): ArgFormat {
  const sourceType = detectSourceType(arg);

  if (sourceType === 'owner-repo') {
    return 'owner-repo';
  }

  if (sourceType === 'remote-url' && extractOwnerRepo(arg) !== null) {
    return 'owner-repo';
  }

  if (sourceType === 'unknown' || sourceType === 'registry') {
    return 'skill-name';
  }

  return 'install-source';
}

export function findRepoInCentralRepository(
  ownerRepo: string,
  skillsService: SkillsService,
): SkillInfo[] | null {
  const [inputOwner, inputRepo] = ownerRepo.split('/');
  const allSkills = skillsService.getAllSkills();

  const providerKey = findOfficialProvider(inputOwner);
  if (providerKey) {
    const officialSource = `official/${providerKey}/${inputRepo}`;
    const officialMatches = allSkills.filter((skill) => skill.source === officialSource);
    if (officialMatches.length > 0) {
      return officialMatches;
    }
  }

  const communitySource = `community/${inputOwner}/${inputRepo}`;
  const communityMatches = allSkills.filter((skill) => skill.source === communitySource);
  if (communityMatches.length > 0) {
    return communityMatches;
  }

  return null;
}

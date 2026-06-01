/**
 * profiles/index.ts
 * 所有 NPC Profile 统一导出
 */

export { EZRA_PROFILE } from './ezra-profile';
export { ARLO_PROFILE } from './arlo-profile';
export { SAMIRA_PROFILE } from './samira-profile';
export { ANVIL_PROFILE } from './anvil-profile';
export { MARA_PROFILE } from './mara-profile';
export { PAX_PROFILE } from './pax-profile';
export { WHISPERER_PROFILE } from './whisperer-profile';

import { NPCProfile } from '../SmartNPC';
import { EZRA_PROFILE } from './ezra-profile';
import { ARLO_PROFILE } from './arlo-profile';
import { SAMIRA_PROFILE } from './samira-profile';
import { ANVIL_PROFILE } from './anvil-profile';
import { MARA_PROFILE } from './mara-profile';
import { PAX_PROFILE } from './pax-profile';
import { WHISPERER_PROFILE } from './whisperer-profile';

export const ALL_PROFILES: NPCProfile[] = [
  EZRA_PROFILE,
  ARLO_PROFILE,
  SAMIRA_PROFILE,
  ANVIL_PROFILE,
  MARA_PROFILE,
  PAX_PROFILE,
  WHISPERER_PROFILE,
];

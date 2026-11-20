import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * A-05's rule families as the console reads them (task 67.8; FR-71 … FR-74) — **held** to the generated enum, so a
 * family the api adds or drops fails this file's compilation.
 */
export const RULE_FAMILY = {
  FACTOR_SET: 'factor_set',
  APPLICABILITY: 'applicability',
  VALIDATION_RULES: 'validation_rules',
} as const;

export type RuleFamily = (typeof RULE_FAMILY)[keyof typeof RULE_FAMILY];

export const RULE_FAMILY_MIRRORS_WIRE: SameSet<RuleFamily, components['schemas']['RulesSlotResponseDto']['family']> = true;

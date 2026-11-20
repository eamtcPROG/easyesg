/**
 * A-05's rule families (task 67.8; UC-80 … UC-82; FR-71 … FR-74) — the three configuration kinds a Platform
 * Administrator publishes from the console: emission factor sets (effective-dated, one per country), the conditional-
 * applicability thresholds (one per standard) and the validation rule set (one per standard). **The family is the wire's
 * word; the kind is the store's**, mapped here once.
 */
export const RULE_FAMILY = {
  FACTOR_SET: 'factor_set',
  APPLICABILITY: 'applicability',
  VALIDATION_RULES: 'validation_rules',
} as const;

export type RuleFamily = (typeof RULE_FAMILY)[keyof typeof RULE_FAMILY];

export const isRuleFamily = (value: unknown): value is RuleFamily =>
  typeof value === 'string' && (Object.values(RULE_FAMILY) as readonly string[]).includes(value);

/** One slot of a family in force: its scope, the window it covers, the revision a change is made against. */
export interface RulesSlot {
  readonly family: RuleFamily;
  readonly scope: string;
  readonly revision: number;
  /** Inclusive calendar day; null for an undated kind or a window open to the past. */
  readonly validFrom: string | null;
  /** Exclusive calendar day; null for an open window. */
  readonly validTo: string | null;
  readonly payload: Record<string, unknown>;
}

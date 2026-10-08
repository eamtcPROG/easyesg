import type { FieldValue } from '@easyesg/validation';

/**
 * The prior period's values a year-over-year rule may compare against (task 41.2; FR-45, FR-46 item 3; 182/28) —
 * **comparable ones only**: the interpreter compares whatever it is given at the same natural key, and a value whose
 * element is absent from this report's version, or whose shape changed, is not one (`year-over-year.ts`). Empty where
 * the period has no prior. Read through `core/comparatives`' own use case, so FR-45's linkage is resolved once.
 */
export interface PriorComparables {
  comparable(query: { readonly reportId: string }): Promise<readonly FieldValue[]>;
}

export const PRIOR_COMPARABLES = Symbol('PRIOR_COMPARABLES');

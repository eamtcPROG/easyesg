import type { PriorPeriodValue, PriorReportPin } from '../models/prior-period-value.model';

/**
 * A stored prior answer, before anyone has asked whether it is comparable.
 *
 * Derived from the domain type by subtraction rather than declared beside it, so an added value
 * column reaches the store automatically and cannot be forgotten here. `comparability` is the one
 * field the database cannot answer: it is a fact about two *taxonomy versions*, which live in the
 * configuration store, not in `core`.
 */
export type StoredPriorValue = Omit<PriorPeriodValue, 'comparability'>;

/**
 * What one query across the period linkage answers.
 *
 * **Three states, resolved in a single statement rather than three round trips.** Whether the
 * report exists, whether its period links to a prior one, and whether that prior period was ever
 * reported on are all decided by the same joins — and splitting them would open a window in which
 * the answer changes between reads, on a path whose entire subject is two periods agreeing.
 */
export interface PriorPeriodReadout {
  /** The *current* report's pin. Carried because the comparison needs both versions, never one. */
  readonly taxonomyVersion: string;
  /** Whether `reporting_period.prior_period_id` is set — FR-45's linkage, present or not. */
  readonly priorPeriodLinked: boolean;
  /** `null` when the linkage is absent, or present and never reported on. */
  readonly prior: (PriorReportPin & { readonly values: readonly StoredPriorValue[] }) | null;
}

/**
 * Reads across two periods (FR-45, FR-46).
 *
 * **No write, and there will not be one.** FR-47's carry-forward writes into *this* year's report
 * through the disclosure store, marked `carried_forward` — it is an ordinary value with a flag, not
 * a comparative. A write here would make this module a second author of the same table.
 */
export interface PriorPeriodStore {
  /** `null` when no such report is visible to the bound tenant — RLS makes that one answer. */
  readFor(query: { readonly reportId: string }): Promise<PriorPeriodReadout | null>;
}

export const PRIOR_PERIOD_STORE = Symbol('PRIOR_PERIOD_STORE');

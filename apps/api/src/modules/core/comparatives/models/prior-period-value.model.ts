import type { DisclosureState } from '@api/modules/core/disclosure/models/disclosure-value.model';

/**
 * Last year's answer, as the current year's field needs to see it (task 34.3; FR-45, FR-46, UC-45).
 *
 * **This module owns no table.** §17.5 gives it FR-45 … FR-47 and architecture.md's component table
 * records its storage as *"— (reads across periods)"*: a comparative is a query over two reports
 * that already exist, never a third copy of a value. Nothing here is persisted.
 */

/**
 * Whether a prior value can be *placed beside* this year's field, which is a different question
 * from whether it was stored.
 *
 * DR-4 makes two taxonomy versions coexist, and a report pins the version it was authored under —
 * so the prior report may be pinned to a version in which the element had a different shape, or did
 * not exist at all. FR-46 shows last year's value "so that an implausible year-over-year movement is
 * visible", and a movement between two differently-defined elements is not a movement.
 *
 * **These are facts read from the registry, not a policy about what to render.** The screen decides
 * that (task 36.14); this says what is true. Deciding it here would put the judgement in the one
 * tier that cannot revisit it, and deciding it in the browser is impossible — `TAXONOMY_REGISTRY` is
 * an api port and the web tier has no way to ask.
 */
export const COMPARABILITY = {
  /** The element exists in both pinned versions with the same kind and period type. */
  COMPARABLE: 'comparable',
  /** The element is not in the *current* report's version — last year reported something this
   *  year's taxonomy no longer names. There is no field to put it beside. */
  ELEMENT_ABSENT: 'element_absent',
  /** Present in both, but its kind or period type moved between the two versions. A duration fact
   *  that became an instant is not the same measurement, which is why `PERIOD_TYPE`'s own header
   *  says the two "are compared differently against the prior period (FR-46)". */
  SHAPE_CHANGED: 'shape_changed',
} as const;

export type Comparability = (typeof COMPARABILITY)[keyof typeof COMPARABILITY];

/**
 * Why there is nothing to show, distinguished rather than collapsed into an empty list.
 *
 * A first-year report and a second-year report whose predecessor was never authored are different
 * situations for a reporter: the first is expected and the second is a gap they may want to close.
 * FR-45 is about the *linkage*, so "the link is absent" and "the link leads to no report" are the
 * two ways it can come to nothing.
 */
export const PRIOR_PERIOD_AVAILABILITY = {
  AVAILABLE: 'available',
  /** No `prior_period_id` on this report's period — normally the entity's first year. */
  NO_PRIOR_PERIOD: 'no_prior_period',
  /** A prior period is linked, but no report was ever created against it. */
  NO_PRIOR_REPORT: 'no_prior_report',
} as const;

export type PriorPeriodAvailability =
  (typeof PRIOR_PERIOD_AVAILABILITY)[keyof typeof PRIOR_PERIOD_AVAILABILITY];

/**
 * One prior answer.
 *
 * The value columns mirror `DisclosureValueContents` rather than reusing it, and the difference is
 * the point: `notAvailableReason` and `carriedForward` are **deliberately absent**. Last year's
 * reason for not answering is last year's report's business, and whether last year's value was
 * itself carried forward is not something this year's field should quietly inherit — FR-47 requires
 * a carry-forward be marked *when it is made*, which is task 36.14's write, not this read.
 */
export interface PriorPeriodValue {
  readonly elementKey: string;
  /** An axis member, or `''` where the element is undimensioned — §7.3's convention. */
  readonly dimensionKey: string;
  readonly ordinal: number;
  readonly valueNumeric: string | null;
  readonly valueText: string | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly unitCode: string | null;
  readonly state: DisclosureState;
  readonly comparability: Comparability;
}

/** Which report the comparatives came from, and under which pin they were authored. */
export interface PriorReportPin {
  readonly reportId: string;
  readonly periodId: string;
  readonly fiscalYear: number;
  readonly taxonomyVersion: string;
}

/**
 * The whole answer for one report.
 *
 * **Both pins are on it, always.** DR-4 makes the version a data dimension, and a comparative read
 * that reported values without saying which two versions produced them would be exactly the "two
 * disagreeing pins with nothing failing" shape §12.5.6's task-31.3 row rejects, one layer up.
 */
export interface PriorPeriodComparatives {
  readonly reportId: string;
  readonly taxonomyVersion: string;
  readonly availability: PriorPeriodAvailability;
  /** `null` unless `availability` is `available`. */
  readonly prior: PriorReportPin | null;
  /** Empty unless `availability` is `available`. */
  readonly values: readonly PriorPeriodValue[];
}

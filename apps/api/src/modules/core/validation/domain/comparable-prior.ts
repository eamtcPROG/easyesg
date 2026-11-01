import type { FieldValue } from '@easyesg/validation';
import {
  COMPARABILITY,
  type PriorPeriodValue,
} from '@api/modules/core/comparatives/models/prior-period-value.model';

/**
 * The prior period's values a year-over-year rule may read (task 41.2; FR-45, FR-46 item 3; 182/28) — **comparable
 * ones only**. The interpreter compares whatever it is given at the same natural key, so a value whose element this
 * report's version no longer names, or whose kind or period type moved, must not reach it: a duration beside an instant
 * is not a movement (`COMPARABILITY`'s own header).
 */
export const comparablePrior = (values: readonly PriorPeriodValue[]): readonly FieldValue[] =>
  values.filter((value) => value.comparability === COMPARABILITY.COMPARABLE);

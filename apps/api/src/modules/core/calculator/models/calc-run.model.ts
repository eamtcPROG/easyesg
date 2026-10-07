import type { OverridingPerson } from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { CalcLineOverride, CalcSourceContents } from './calc-source.model';
import type { FactorSetPin } from './factor-set.model';

/**
 * A calculation committed, with the inputs it read — P-11's *inputs retained at the run* (task 38.1; FR-35, NFR-19).
 *
 * **Immutable once recorded**: the request tier holds no `UPDATE` or `DELETE` on either table, so a run is the record
 * of what one calculation read, and an edit to a line afterwards changes the working set and never the run.
 */

/** One line as the run read it. */
export interface CalcInput {
  /** The line it was copied from — provenance, since the line may since have changed or gone. */
  readonly sourceId: string;
  readonly siteOrdinal: number;
  readonly sourceKey: string;
  readonly description: string | null;
  readonly contents: CalcSourceContents;
  /** The line's substituted figure as the run read it — part of what it retained, so its replay reproduces it. */
  readonly override: CalcLineOverride | null;
  /** Who had made that substitution when the run read it (task 39.4), named as it reads now. */
  readonly overriddenBy: OverridingPerson | null;
}

export interface CalcRun {
  readonly id: string;
  readonly reportId: string;
  /** FR-35's pin — the factor set the run applies, readable by `FACTOR_SETS.pinned` after it has moved on. */
  readonly factorSet: FactorSetPin;
  readonly recordedAt: Date;
  /** The account that ran it, bound by the request rather than named by it. */
  readonly recordedBy: string | null;
  /** Every line the report held when the run was recorded, in the order the report lists them. */
  readonly inputs: readonly CalcInput[];
}

/**
 * One B3 figure a run computed (task 38.4) — §7.2's `CALC_RESULT`: tonnes of CO₂-equivalent, unrounded, or `null`
 * where no line of its scope was measured (FR-30).
 */
export interface CalcResult {
  readonly elementKey: string;
  readonly tonnesCo2e: string | null;
}

/** A recorded run with the results it stored — what a replay compares against. */
export interface StoredCalcRun extends CalcRun {
  readonly results: readonly CalcResult[];
}

/**
 * The report's latest run as S-09 shows it (task 39.2): which set it pinned and when, and what it stored — the figures
 * B3 holds from it, and *now* beside UX-44's *would be* when a newer set is in force. No inputs: the lines on screen are
 * the working set, and a run's own copy is `find`'s.
 */
export interface LatestCalcRun {
  readonly id: string;
  readonly factorSet: FactorSetPin;
  readonly recordedAt: Date;
  readonly results: readonly CalcResult[];
}

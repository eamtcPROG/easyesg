import type { FieldAddress } from '@easyesg/validation';

/**
 * UC-38's roll-up, per module and for the report (task 41.3; FR-41; §12.5.6's task-182 validation row, 182/18) —
 * **counts and a derived status, never a percentage**. Computed by a run and read as it left it (FR-41 item 8).
 */
export interface Counts {
  /** Answered — a value, a nil return included — and nothing outstanding on it. */
  readonly resolved: number;
  /** Declared not available, with its reason (FR-32), and nothing outstanding on it. */
  readonly reasoned: number;
  /** Carrying a finding — what FR-40's four verdicts do not count as resolved. */
  readonly outstanding: number;
}

export interface ModuleRollUp extends Counts {
  readonly module: string;
  /** The fields outstanding in it, so FR-164's notice can name them (FR-41 AC-6). */
  readonly outstandingFields: readonly FieldAddress[];
}

export interface RollUp {
  readonly report: Counts;
  /** Every module in the report's scope, in the standard's order — one nothing touched with zero counts. */
  readonly modules: readonly ModuleRollUp[];
}

/**
 * A module's or the report's derived status (182/18) — the wizard's own derivation (task 179.1), read in this order:
 * nothing resolved or reasoned is *not started*, whatever is outstanding; then something outstanding is *in progress*;
 * otherwise *complete*, which for the report reads ready to file (182/19).
 */
export const COMPLETION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
} as const;

export type CompletionStatus = (typeof COMPLETION_STATUS)[keyof typeof COMPLETION_STATUS];

export const completionStatus = (counts: Counts): CompletionStatus => {
  if (counts.resolved + counts.reasoned === 0) return COMPLETION_STATUS.NOT_STARTED;
  return counts.outstanding > 0 ? COMPLETION_STATUS.IN_PROGRESS : COMPLETION_STATUS.COMPLETE;
};

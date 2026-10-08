import type { Finding } from '@easyesg/validation';
import type { LegalDate } from '@api/contracts/types/time';
import type { RollUp } from './roll-up.model';

/**
 * A report's validation run (task 41.2; FR-43) — not TypeORM entities (AD-14 constraint 1); instants are `Date`, made
 * epoch-ms at the DTO boundary (OQ-50).
 */
export interface ValidationRun {
  readonly evaluatedAt: Date;
  /** Who asked for it, from the request's own binding — null for an evaluation nobody asked for by hand (182/26). */
  readonly evaluatedBy: string | null;
  /**
   * The day the rule set was read as at, with the zone that settles it (FR-73 item 9): today in the period's zone while
   * it is open, the lock's day once it is locked.
   */
  readonly rulesOn: LegalDate;
  /** The revision read — for a locked report, the one its lock pinned (§12.5.6's task-41 row (5)). */
  readonly rulesRevision: number;
}

/** A run as stored, with its findings in the interpreter's own order and its roll-up (task 41.3). */
export interface StoredValidation {
  readonly run: ValidationRun;
  readonly findings: readonly Finding[];
  readonly rollUp: RollUp;
}

/**
 * What a reader is answered (FR-40, FR-43): the last run and its findings, the ones whose field has left the report's
 * scope since dropped (182/26). `run` is null for a report never validated, which has no findings rather than none
 * outstanding.
 */
export interface ValidationReading {
  readonly run: ValidationRun | null;
  readonly findings: readonly Finding[];
  /**
   * UC-38's roll-up as the run left it (task 41.3; FR-41 item 8) — null with the run. **Not filtered like the findings**:
   * it is the run's own result, and readiness is read from it (row (h)); after a scope change the findings can name
   * fewer fields than it counts, until the next run.
   */
  readonly rollUp: RollUp | null;
}

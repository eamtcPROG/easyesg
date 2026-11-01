import type { FieldAddress, Finding, RuleSet } from '@easyesg/validation';
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
  /**
   * Where each element of the report's scope sits — the modules that present it, as the run's scope computed them
   * (task 42.2). What names a finding's step: a field in B3 and C3 is reached from either.
   */
  readonly placedIn: ReadonlyMap<string, readonly string[]>;
  /** The taxonomy version the report pins, whose labels name a finding's field (task 42.2; DR-4). */
  readonly taxonomyVersion: string;
}

/**
 * What the browser evaluates a report against inline (task 42.1; FR-40 item 5, OQ-49; §12.5.6's task-42 row (1)): the
 * rules a run would read today — the set in force in the period's zone, or the revision the lock pinned — the day they
 * are read as at, and the elements of the report's scope as a run computes them. **The same two reads as a run**, so the
 * browser's inline verdict and the next run's are the interpreter's over the same rules and the same scope.
 */
export interface ValidationRules {
  readonly rulesOn: LegalDate;
  readonly ruleSet: RuleSet;
  /** The elements a rule may read, in no particular order — the browser narrows it to the open step's. */
  readonly scope: readonly string[];
}

/**
 * A field as S-08 names it (task 42.2; FR-42): its address, its label and its member's in the reader's locale — `null`
 * where the catalogue words none — and the modules that present it in the report's scope, empty where none does.
 */
export interface FieldPlace extends FieldAddress {
  readonly label: string | null;
  readonly memberLabel: string | null;
  readonly modules: readonly string[];
}

/** A finding with its field, and each field it relates to, named and placed (task 42.2). */
export interface PlacedFinding extends Omit<Finding, 'field' | 'related'> {
  readonly field: FieldPlace;
  readonly related: readonly FieldPlace[];
}

/** What a reader is answered over HTTP (task 42.2): the reading, its findings named and placed. */
export interface NamedValidation {
  readonly run: ValidationRun | null;
  readonly findings: readonly PlacedFinding[];
  readonly rollUp: RollUp | null;
}

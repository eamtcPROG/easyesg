import type { LegalDate } from '@api/contracts/types/time';

/**
 * The reporting period (FR-21, FR-45, FR-66; UC-56).
 *
 * **Every boundary is a `LegalDate`, never an instant** (NFR-34). *31 December 2026* is the exact
 * case: stored as an epoch value it falls in the wrong fiscal year for a reader in another zone,
 * and a report filed against the wrong year is not correctable by editing.
 */
export interface ReportingPeriod {
  readonly id: string;
  readonly reportingEntityId: string;
  /**
   * The year the undertaking labels this period with. **Stated, not derived** — FR-21 names it
   * beside the dates because a fiscal year straddling two calendar years is labelled by the
   * undertaking rather than by arithmetic on its boundaries.
   */
  readonly fiscalYear: number;
  readonly periodStart: LegalDate;
  /** The last day **in** the period, not the first day after it. */
  readonly periodEnd: LegalDate;
  /**
   * FR-21's optional due date — when the report must be complete, which is a different fact from
   * when the period ends, and what UC-170's deadline notices count down to.
   */
  readonly dueDate: LegalDate | null;
  /** DR-4's pin, copied at open and never moved silently. */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /**
   * FR-45's linkage: the period immediately preceding this one for the same entity, from which
   * comparatives resolve without manual selection. Null for an entity's first period.
   */
  readonly priorPeriodId: string | null;
  /** FR-18's master data as it stood at open. Null only for a period opened before task 31.1. */
  readonly entitySnapshotId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What UC-56 establishes. The pins and the linkage are the system's to resolve, never the caller's. */
export interface NewReportingPeriod {
  readonly reportingEntityId: string;
  readonly fiscalYear: number;
  readonly periodStart: LegalDate;
  readonly periodEnd: LegalDate;
  readonly dueDate: LegalDate | null;
}

/**
 * The fields UC-56 does not settle and a later edit may. **The pins are absent by construction** —
 * DR-4 makes moving a version an explicit migration (FR-69), not a patch, so there is no shape in
 * which this type could express one.
 */
export interface ReportingPeriodPatch {
  readonly fiscalYear?: number;
  readonly periodStart?: LegalDate;
  readonly periodEnd?: LegalDate;
  readonly dueDate?: LegalDate | null;
}

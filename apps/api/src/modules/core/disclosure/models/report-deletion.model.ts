/**
 * What `core.delete_report` answers (task 192; FR-210; `architecture.md` §12.5.6's task-192 row (2)) — the function's
 * four words, mirrored here as the migration's `RETURN`s are their literal copy. Only `DELETED` changed anything.
 */
export const REPORT_DELETION = {
  DELETED: 'deleted',
  /** Unknown, outside the bound organization, or deleted already — all 404, as FR-210's refusals say. */
  NOT_FOUND: 'not_found',
  /** Its entity is archived, which retains its reports and outranks the lock (FR-20 behaviour 7; task 214). */
  ARCHIVED: 'archived',
  /** Its period is locked (FR-22: the lock outranks the role). */
  LOCKED: 'locked',
  /** An export of it was requested or completed: distribution evidence (FR-53). */
  EXPORTED: 'exported',
} as const;

export type ReportDeletion = (typeof REPORT_DELETION)[keyof typeof REPORT_DELETION];

/** Is this unvalidated answer one of the four? Anything else is a function the code no longer matches. */
export const isReportDeletion = (value: unknown): value is ReportDeletion =>
  (Object.values(REPORT_DELETION) as readonly unknown[]).includes(value);

import type { LegalDate } from '@api/contracts/types/time';

/**
 * The reporter's filed mark on `core.report` (task 47.5; FR-41; §12.5.6's task-47 row (1)–(4)) — its own port beside
 * the report store, because only the filing routes write it and nothing that reads a report needs to.
 *
 * **Who and when are the database's**, stamped from the request's binding by `core.stamp_report_filing`; the store
 * writes the date and its zone alone. Every statement runs on the request's transaction, under the report's
 * row-level security.
 */
export interface ReportFilingStore {
  /**
   * Marks the report filed on `filedOn` — **only where an export of it has completed**, checked in the same statement
   * that writes. Answers whether it wrote: `false` is a report with no completed export, or none at all in the bound
   * organization, which the caller has already told apart.
   */
  mark(command: { readonly reportId: string; readonly filedOn: LegalDate }): Promise<boolean>;

  /** Clears the mark, and with it who and when. Answers whether the report exists. */
  withdraw(command: { readonly reportId: string }): Promise<boolean>;
}

export const REPORT_FILING_STORE = Symbol('REPORT_FILING_STORE');

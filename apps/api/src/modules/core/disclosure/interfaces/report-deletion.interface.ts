import type { ReportDeletion } from '../models/report-deletion.model';

/**
 * FR-210's deletion of a report (task 192; §12.5.6's task-192 row (2)) — its own port beside the report store, because
 * one route writes it and no reader needs it.
 *
 * **The conditions are the database's**: `core.delete_report` locks the row, reads the period's lock and the exports, and
 * marks the report deleted, in the request's transaction, and answers which of the four outcomes held. A deleted report
 * is hidden from every later read by row security; nothing is removed.
 */
export interface ReportDeletionStore {
  delete(command: { readonly reportId: string }): Promise<ReportDeletion>;
}

export const REPORT_DELETION_STORE = Symbol('REPORT_DELETION_STORE');

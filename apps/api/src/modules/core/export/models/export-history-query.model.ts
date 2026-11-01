import type { Locale } from '@easyesg/i18n';
import type { ExportFormat, ExportStatus } from '../constants/export.constants';
import type { ExportRecord } from './export-record.model';

/**
 * The facets S-11's history filters by (design_spec.md §4's S-11 row: format · language · taxonomy version) — and its
 * status, which S-11 asks of the whole history to know whether a report has a completed export to mark filed (§12.5.6's
 * task-47 row (4), (n)).
 */
export const EXPORT_HISTORY_FILTER = {
  FORMAT: 'format',
  LANGUAGE: 'language',
  TAXONOMY_VERSION: 'taxonomyVersion',
  STATUS: 'status',
} as const;

/** The one ordering it offers — newest first, or oldest. */
export const EXPORT_HISTORY_SORT = { REQUESTED: 'requested' } as const;

/** One report's history, narrowed from §6.8's compact list query (task 47.1). */
export interface ExportHistoryQuery {
  readonly reportId: string;
  readonly formats: readonly ExportFormat[];
  readonly locales: readonly Locale[];
  readonly taxonomyVersions: readonly string[];
  readonly statuses: readonly ExportStatus[];
  readonly newestFirst: boolean;
  readonly skip: number;
  readonly take: number;
}

/** A page of it, with what the facets matched and what the report holds before them — S-11's two empty states. */
export interface ExportHistoryPage {
  readonly records: readonly ExportRecord[];
  readonly matched: number;
  readonly total: number;
}

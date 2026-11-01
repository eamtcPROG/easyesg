import type { Locale } from '@easyesg/i18n';
import type { ExportFormat } from '../constants/export.constants';

/** An export still waiting for its file (task 44.2) — what its job reads before producing it. */
export interface RequestedExport {
  readonly id: string;
  readonly reportId: string;
  /** What file was asked for — a job produces its own format and no other (task 46). */
  readonly format: ExportFormat;
  /** The file's language, the export's own (FR-52). */
  readonly locale: Locale;
  /** Who asked, by the name they are shown under (UX-137) — `null` where the account is gone. */
  readonly requestedBy: string | null;
  /** Who asked, by account — the one person its completion notice reaches (task 47.3). */
  readonly requestedById: string;
  /** When it was asked for — what decides whether its completion is worth a notice (§12.5.6's task-47 row (5)). */
  readonly requestedAt: Date;
  /** The undertaking and the year the report is of, which the notice names. */
  readonly subject: { readonly entityName: string; readonly fiscalYear: number };
}

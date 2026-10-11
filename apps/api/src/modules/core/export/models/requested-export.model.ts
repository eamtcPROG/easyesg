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
}

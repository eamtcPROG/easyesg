import type { Locale } from '@easyesg/i18n';

/** An export still waiting for its file (task 44.2) — what its job reads before producing it. */
export interface RequestedExport {
  readonly id: string;
  readonly reportId: string;
  /** The file's language, the export's own (FR-52). */
  readonly locale: Locale;
  /** Who asked, by the name they are shown under (UX-137) — `null` where the account is gone. */
  readonly requestedBy: string | null;
}

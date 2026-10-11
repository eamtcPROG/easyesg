import type { JobRetry } from '@api/infrastructure/queue/retries-with';

/**
 * The outbox event an export request writes for a PDF (task 44.2; FR-49) — the job `PdfExportRequestedHandler` claims
 * on the worker. Its key is the export's own id, so a re-emitted row is the same job (AD-6).
 */
export const EXPORT_PDF_REQUESTED = 'export.pdf.requested';

/**
 * The outbox event an export request writes for the EFRAG Digital Template (task 46; FR-50) — the job
 * `XlsxExportRequestedHandler` claims on the worker, on the export queue beside the PDF's, with the same retry.
 */
export const EXPORT_XLSX_REQUESTED = 'export.xlsx.requested';

/**
 * §12.5.6's task-44 row (4): an export is attempted three times, backing off exponentially from 10 s, each attempt on
 * a fresh browser (T-13) — and recorded failed after the third. Its own retry, rather than the delivery retry's eleven
 * attempts over seventeen hours, which would leave a broken export reading *requested* for most of a day.
 */
export const EXPORT_RETRY: JobRetry = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
};

/** Where an export stands — `core.export_artifact.status`'s `CHECK`, mirrored. */
export const EXPORT_STATUS = {
  REQUESTED: 'requested',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ExportStatus = (typeof EXPORT_STATUS)[keyof typeof EXPORT_STATUS];

/** What a file is — `core.export_artifact.format`'s `CHECK`, mirrored; the Excel export joined it with task 46. */
export const EXPORT_FORMAT = { PDF: 'pdf', XLSX: 'xlsx' } as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

/** Whether a stored format is one this platform produces — the `CHECK`'s own question, asked of a row read. */
export const isExportFormat = (value: string): value is ExportFormat => (Object.values(EXPORT_FORMAT) as string[]).includes(value);

/** Each format's media type — what the stored object is served as, and what a re-download answers (task 47.1). */
export const EXPORT_MEDIA_TYPE: Readonly<Record<ExportFormat, string>> = {
  [EXPORT_FORMAT.PDF]: 'application/pdf',
  [EXPORT_FORMAT.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

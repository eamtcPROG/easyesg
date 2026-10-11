import type { Locale } from '@easyesg/i18n';
import type { ExportFormat, ExportStatus } from '../constants/export.constants';

/**
 * One export as its history reads it (task 47.1; FR-53; UX-49) — `core.export_artifact`, every state of it: requested
 * while its job runs, completed with its file, or failed. **What an operator reads of a failure stays withheld**: the
 * row's `failure` is for the support log, never for a reader as it stands (task 44.2).
 */
export interface ExportRecord {
  readonly id: string;
  readonly reportId: string;
  readonly format: ExportFormat;
  /** The file's language, the export's own (FR-52). */
  readonly locale: Locale;
  /** The versions it was produced at, stamped from the report's pin when it was asked for (DR-4). */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  readonly status: ExportStatus;
  readonly requestedAt: Date;
  /** Who asked, by the name they are shown under (UX-137) — a `null` name where the account is gone. */
  readonly requestedBy: { readonly accountId: string; readonly name: string | null };
  /** When its file was stored — `null` until it is. */
  readonly completedAt: Date | null;
  /** When its last attempt failed — `null` unless it did. */
  readonly failedAt: Date | null;
  /** The stored file's size in bytes — `null` until it is stored. */
  readonly byteSize: number | null;
}

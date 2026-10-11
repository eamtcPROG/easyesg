import type { Locale } from '@easyesg/i18n';
import type { ExportFormat } from '../constants/export.constants';
import type { ExportHistoryPage, ExportHistoryQuery } from '../models/export-history-query.model';
import type { ExportRecord } from '../models/export-record.model';

/** An export's record with where its file is kept and the digest it was stored under — the re-download's to read. */
export interface StoredExport {
  readonly record: ExportRecord;
  /** `null` until the file is stored. */
  readonly objectKey: string | null;
  readonly sha256: string | null;
}

/**
 * `core.export_artifact` as the request tier writes and reads it (tasks 47.1, 47.4) — on the request's transaction,
 * under the table's row-level security. The worker's side, which settles a row, is `ExportArtifactStore`.
 */
export interface ExportHistoryStore {
  /**
   * Writes an export's request: its record — whose requester and versions the database stamps (task 44.2) — and the
   * outbox event its job claims, keyed by the export's own id, so the two commit together or not at all (AD-6).
   */
  request(command: {
    readonly exportId: string;
    readonly reportId: string;
    readonly format: ExportFormat;
    readonly locale: Locale;
  }): Promise<void>;

  /** One page of a report's exports, every state, with what the facets matched and what the report holds. */
  list(query: ExportHistoryQuery): Promise<ExportHistoryPage>;

  /** One export with its file's place, or `null` where there is none in the bound organization. */
  find(query: { readonly exportId: string }): Promise<StoredExport | null>;
}

export const EXPORT_HISTORY = Symbol('EXPORT_HISTORY');

import type { Locale } from '@easyesg/i18n';
import { EXPORT_STATUS, type ExportFormat } from '../constants/export.constants';
import type { ExportHistoryStore, StoredExport } from '../interfaces/export-history.interface';
import type { ExportHistoryPage, ExportHistoryQuery } from '../models/export-history-query.model';
import type { ExportRecord } from '../models/export-record.model';

/**
 * `core.export_artifact` as the request tier sees it (tasks 47.1, 47.4), modelling what the real store guarantees: a
 * request writes the record **and** its job, the requester and the versions stamped rather than supplied — here by the
 * fake's own actor and pin, as the database stamps them from the binding and the report.
 */
export class FakeExportHistory implements ExportHistoryStore {
  readonly stored = new Map<string, StoredExport>();
  readonly jobs: { readonly exportId: string; readonly format: ExportFormat }[] = [];

  constructor(
    private readonly pin = { templateVersion: '1.3.0', taxonomyVersion: '2026-05-01' },
    private readonly actor = { accountId: '00000000-0000-0000-0000-0000000000d1', name: 'Ana Rusu' },
    private readonly now = new Date('2026-10-12T09:00:00Z'),
  ) {}

  request(command: { readonly exportId: string; readonly reportId: string; readonly format: ExportFormat; readonly locale: Locale }): Promise<void> {
    const record: ExportRecord = {
      id: command.exportId,
      reportId: command.reportId,
      format: command.format,
      locale: command.locale,
      ...this.pin,
      status: EXPORT_STATUS.REQUESTED,
      requestedAt: this.now,
      requestedBy: this.actor,
      completedAt: null,
      failedAt: null,
      byteSize: null,
    };
    this.stored.set(command.exportId, { record, objectKey: null, sha256: null });
    this.jobs.push({ exportId: command.exportId, format: command.format });
    return Promise.resolve();
  }

  /** What the worker's settling does, for a case that needs a completed export. */
  complete(exportId: string, file: { readonly objectKey: string; readonly sha256: string; readonly byteSize: number }): void {
    const stored = this.stored.get(exportId);
    if (!stored) throw new Error(`no export ${exportId}`);
    this.stored.set(exportId, {
      record: { ...stored.record, status: EXPORT_STATUS.COMPLETED, completedAt: this.now, byteSize: file.byteSize },
      objectKey: file.objectKey,
      sha256: file.sha256,
    });
  }

  list(query: ExportHistoryQuery): Promise<ExportHistoryPage> {
    const all = [...this.stored.values()].map((stored) => stored.record).filter((record) => record.reportId === query.reportId);
    const matched = all.filter(
      (record) =>
        (query.formats.length === 0 || query.formats.includes(record.format)) &&
        (query.locales.length === 0 || query.locales.includes(record.locale)) &&
        (query.taxonomyVersions.length === 0 || query.taxonomyVersions.includes(record.taxonomyVersion)) &&
        (query.statuses.length === 0 || query.statuses.includes(record.status)),
    );
    return Promise.resolve({ records: matched.slice(query.skip, query.skip + query.take), matched: matched.length, total: all.length });
  }

  find(query: { readonly exportId: string }): Promise<StoredExport | null> {
    return Promise.resolve(this.stored.get(query.exportId) ?? null);
  }
}

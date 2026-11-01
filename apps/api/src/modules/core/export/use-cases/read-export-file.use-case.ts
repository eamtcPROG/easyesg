import type { ObjectReader } from '@api/contracts/object-storage.port';
import { EXPORT_STATUS } from '../constants/export.constants';
import { ExportFileUnavailableError, ExportNotFoundError } from '../errors/export.errors';
import type { ExportHistoryStore } from '../interfaces/export-history.interface';
import type { ExportRecord } from '../models/export-record.model';

/**
 * UC-44's re-download (task 47.1; FR-53): **the stored file, exactly as distributed** — never regenerated, since
 * nothing upstream promises to stand still (182/126) — streamed by the api rather than through a presigned address,
 * which would be a bearer credential around the session proxy (§12.5.6's task-47 row (c)).
 *
 * **The bytes are held to the digest recorded when they were stored**: a store answering other bytes under the key is a
 * defect to surface, and serving them would hand a reader a file that is not the one sent. Never gated by an
 * entitlement — previously generated documents stay downloadable whatever the plan (FR-104; row (e)).
 */
export class ReadExportFile {
  constructor(
    private readonly history: Pick<ExportHistoryStore, 'find'>,
    private readonly files: ObjectReader,
    private readonly digest: (body: Buffer) => string,
  ) {}

  async execute(query: { readonly exportId: string }): Promise<{ readonly record: ExportRecord; readonly body: Buffer }> {
    const stored = await this.history.find(query);
    if (stored === null) throw new ExportNotFoundError();
    const { record, objectKey, sha256 } = stored;
    if (record.status !== EXPORT_STATUS.COMPLETED || objectKey === null || sha256 === null) throw new ExportFileUnavailableError();
    const body = await this.files.get({ key: objectKey });
    if (this.digest(body) !== sha256) throw new Error(`Export ${record.id}'s stored file does not match the digest it was stored under`);
    return { record, body };
  }
}

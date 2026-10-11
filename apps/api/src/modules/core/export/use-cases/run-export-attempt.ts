import { createHash } from 'node:crypto';
import type { ObjectStorage } from '@api/contracts/object-storage.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { EXPORT_MEDIA_TYPE, type ExportFormat } from '../constants/export.constants';
import { exportObjectKey } from '../domain/export-object-key';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { RequestedExport } from '../models/requested-export.model';

/** One attempt of an export's job, as the queue hands it over. */
export interface ExportAttemptCommand {
  readonly organizationId: string;
  readonly exportId: string;
  /** Which attempt this is, and how many the job is given — the last records the failure (§12.5.6's task-44 row (4)). */
  readonly attempt: number;
  readonly attempts: number;
}

/**
 * One attempt to produce an export's file, whatever its format (tasks 44.2, 46; FR-49, FR-50, FR-53, AD-10) — what the
 * PDF's job and the Excel export's job share, so the two settle a record by one rule.
 *
 * **Three steps, two units of work, and nothing held open across producing the file.** The record is read and the
 * report composed inside the organization's unit of work (`TENANT_WORK`), which ends before the file is made — a render
 * may run a minute (§12.5.6's task-44 row (4)) and a transaction held across it would hold a connection with it. The
 * file is stored under a key of its own export, so an attempt abandoned after storing is overwritten by the next, and
 * the record is settled in a second unit of work.
 *
 * **Effectively once** (AD-6): an export already settled reads as none, so a re-emitted job, or one that follows an
 * attempt which settled it, does nothing. **A job produces its own format and no other**: an export asking for another
 * is a defect in whatever enqueued it, and is refused like any failure. **A failure is recorded on the last attempt
 * only**, and every failure is thrown so the queue retries it; the earlier attempts' failures are the queue's to keep.
 */
export async function runExportAttempt<Composed>(input: {
  readonly command: ExportAttemptCommand;
  readonly format: ExportFormat;
  readonly tenantWork: TenantWork;
  readonly store: ExportArtifactStore;
  readonly storage: ObjectStorage;
  readonly now: () => Date;
  /** Reads what the file is made from, inside the organization's unit of work. */
  readonly compose: (requested: RequestedExport, generatedAt: Date) => Promise<Composed>;
  /** Makes the file, outside any unit of work. */
  readonly produce: (composed: Composed, generatedAt: Date) => Promise<Uint8Array>;
}): Promise<void> {
  const { command, format, tenantWork, store } = input;
  const { organizationId, exportId } = command;
  const generatedAt = input.now();
  try {
    const composed = await tenantWork.inOrganization({ organizationId }, async () => {
      const requested = await store.findRequested({ exportId });
      if (requested === null) return null;
      if (requested.format !== format) throw new Error(`Export ${exportId} asks for a ${requested.format} file, not ${format}.`);
      return { value: await input.compose(requested, generatedAt) };
    });
    if (composed === null) return;

    const file = await input.produce(composed.value, generatedAt);
    const objectKey = exportObjectKey({ organizationId, exportId, format });
    const body = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
    await input.storage.put({ key: objectKey, body, contentType: EXPORT_MEDIA_TYPE[format] });
    await tenantWork.inOrganization({ organizationId }, () =>
      store.complete({
        exportId,
        generatedAt,
        objectKey,
        byteSize: file.byteLength,
        sha256: createHash('sha256').update(file).digest('hex'),
      }),
    );
  } catch (error) {
    if (command.attempt >= command.attempts) {
      await tenantWork.inOrganization({ organizationId }, () =>
        store.fail({ exportId, failure: error instanceof Error ? error.message : String(error) }),
      );
    }
    throw error;
  }
}

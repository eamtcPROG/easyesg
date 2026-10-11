import type { RequestedExport } from '../models/requested-export.model';

/**
 * `core.export_artifact`, as the export's job reads and settles it (task 44.2). Settling is once: the table's policy
 * admits a row only while it is requested, so a second job for one export finds nothing to read and nothing to write.
 */
export interface ExportArtifactStore {
  /** The export, while it is still requested — `null` once settled, or where there is none in the bound organization. */
  findRequested(query: { readonly exportId: string }): Promise<RequestedExport | null>;

  /** Records the file: when it was produced, where it is stored, its size and its SHA-256 (FR-53). */
  complete(command: {
    readonly exportId: string;
    readonly generatedAt: Date;
    readonly objectKey: string;
    readonly byteSize: number;
    readonly sha256: string;
  }): Promise<void>;

  /** Records that the last attempt failed, and why — for an operator, never for a reader as it stands. */
  fail(command: { readonly exportId: string; readonly failure: string }): Promise<void>;
}

export const EXPORT_ARTIFACT_STORE = Symbol('EXPORT_ARTIFACT_STORE');

import type { Locale } from '@easyesg/i18n';
import type { ExportFormat } from '../constants/export.constants';
import type { ExportHistoryStore } from '../interfaces/export-history.interface';
import type { ExportRecord } from '../models/export-record.model';

export interface RequestExportCommand {
  readonly reportId: string;
  readonly format: ExportFormat;
  readonly locale: Locale;
  /** Whether the person asking acknowledged the unresolved findings the warning listed (FR-44; 182/20). */
  readonly acknowledgeUnresolvedFindings: boolean;
  /** How many findings the validation run this request made left unresolved (182/26). */
  readonly unresolvedFindings: number;
}

/** What a request came to. A refusal writes nothing of the export; the run it made is its caller's to keep. */
export const EXPORT_REQUEST_OUTCOME = { QUEUED: 'queued', REFUSED: 'refused' } as const;

export type ExportRequestOutcome =
  | { readonly kind: typeof EXPORT_REQUEST_OUTCOME.QUEUED; readonly export: ExportRecord }
  | { readonly kind: typeof EXPORT_REQUEST_OUTCOME.REFUSED };

/**
 * UC-42 and UC-43's request (task 47.4; FR-44, FR-49, FR-50, FR-52; §12.5.6's task-182 validation row, 182/20, and the
 * task-47 row (a), (b), (7)): **an export of a report holding unresolved findings is refused until they are
 * acknowledged**, then queued like any other — nothing is refused for good, and no finding gates an export (182/27).
 *
 * **The run is its caller's**: validation is evaluated at the request, on a locked period too, and stored as the
 * report's run before this decides (row (7)), so this is told the count rather than running it. **Queued is the record
 * and its job together**, written in the request's transaction; the report's status is left as it was (182/19), and
 * the export uses the report's own pin, which the record's stamp copies (FR-51).
 */
export class RequestExport {
  constructor(
    private readonly history: ExportHistoryStore,
    private readonly newId: () => string,
  ) {}

  async execute(command: RequestExportCommand): Promise<ExportRequestOutcome> {
    if (command.unresolvedFindings > 0 && !command.acknowledgeUnresolvedFindings) return { kind: EXPORT_REQUEST_OUTCOME.REFUSED };
    const exportId = this.newId();
    await this.history.request({ exportId, reportId: command.reportId, format: command.format, locale: command.locale });
    const queued = await this.history.find({ exportId });
    // The row was written in this transaction a statement ago; not reading it back is a defect, not a missing export.
    if (queued === null) throw new Error(`Export ${exportId} was requested and cannot be read back`);
    return { kind: EXPORT_REQUEST_OUTCOME.QUEUED, export: queued.record };
  }
}

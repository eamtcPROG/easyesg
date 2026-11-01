import type { Locale } from '@easyesg/i18n';
import type { ReportDocumentRenderer } from '@api/contracts/report-document.port';
import type { ComposeReportDocument } from './compose-report-document.use-case';

export interface PreviewReportQuery {
  readonly reportId: string;
  /** The document's language — the export's, chosen on S-10 and opening in the account's export default (182/34). */
  readonly locale: Locale;
}

/**
 * UC-41 — the assembled report as the export will print it, without generating a file (task 43.1; FR-48; §12.5.6's
 * task-43 row): the document `ComposeReportDocument` reads, with none of a file's own facts, rendered to the markup
 * S-10 frames. It writes nothing — no file and no export record (FR-48 AC-2).
 */
export class PreviewReport {
  constructor(
    private readonly compose: Pick<ComposeReportDocument, 'execute'>,
    private readonly renderer: ReportDocumentRenderer,
  ) {}

  async execute(query: PreviewReportQuery): Promise<string> {
    return this.renderer.render(await this.compose.execute({ ...query, production: null }));
  }
}

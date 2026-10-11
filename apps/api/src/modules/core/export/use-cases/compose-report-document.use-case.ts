import type { Locale } from '@easyesg/i18n';
import type { DocumentProduction, ReportDocument } from '@api/contracts/report-document.port';
import type { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import { assembleReportDocument } from '../domain/report-document';
import type { ReadReportContents } from './read-report-contents.use-case';

export interface ComposeReportDocumentQuery {
  readonly reportId: string;
  /** The document's language — the export's, never the request's (FR-52, 182/34). */
  readonly locale: Locale;
  /** Who produced the file and when — `null` for the preview, which produces none (FR-48 AC-2). */
  readonly production: DocumentProduction | null;
}

/**
 * The report as its document's model — what the preview renders and the export's job prints (tasks 43.1, 44; FR-48,
 * FR-49; §12.5.6's task-43 row), one composition for both so the two cannot drift.
 *
 * **It reads what the screens read, and nothing of its own** — through `ReadReportContents`, which the Excel export's
 * composition reads too (task 46), so neither file can say something S-07, S-08 or S-09 does not — and the prior
 * period's values, which only the document prints (182/33). It writes nothing.
 */
export class ComposeReportDocument {
  constructor(
    private readonly contents: Pick<ReadReportContents, 'execute'>,
    private readonly prior: Pick<ReadPriorPeriodValues, 'read'>,
  ) {}

  async execute(query: ComposeReportDocumentQuery): Promise<ReportDocument> {
    const { reportId, locale } = query;
    const contents = await this.contents.execute({ reportId, locale });
    const prior = await this.prior.read({ reportId });
    const { report } = contents;

    return assembleReportDocument({
      locale,
      report: {
        ...report.subject,
        scope: report.scope,
        templateVersion: report.templateVersion,
        taxonomyVersion: report.taxonomyVersion,
        reportingCurrency: report.reportingCurrency,
      },
      modules: contents.modules,
      steps: new Map<string, readonly DisclosureField[]>([...contents.steps].map(([module, step]) => [module, step.fields])),
      inScope: contents.inScope,
      prior,
      run: contents.run,
      findings: contents.findings,
      precision: contents.precision,
      labelStanding: contents.labelStanding,
      production: query.production,
    });
  }
}

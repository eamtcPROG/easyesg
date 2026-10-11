import type { Locale } from '@easyesg/i18n';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import type { PresentationPrecision } from '@api/contracts/presentation-precision.port';
import type { DocumentProduction, ReportDocument } from '@api/contracts/report-document.port';
import type { ReadCalcFigures } from '@api/modules/core/calculator/use-cases/read-calc-figures.use-case';
import type { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { ReportStore } from '@api/modules/core/disclosure/interfaces/report-store.interface';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import type { ReadWizardStep } from '@api/modules/core/disclosure/use-cases/read-wizard-step.use-case';
import type { RunValidation } from '@api/modules/core/validation/use-cases/run-validation.use-case';
import { assembleReportDocument, modulesToRead } from '../domain/report-document';

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
 * **It reads what the screens read, and nothing of its own**: the report, every module of it in the document's
 * language through the wizard's own step read, the scope a validation run evaluates, the prior period's values, the
 * latest calculator run and the last validation run — and, since task 44, whose words the labels are at the report's
 * pinned version (UX-98). So the document cannot say something S-07, S-08 or S-09 does not. It writes nothing.
 *
 * **The reads run one after another**, on the caller's one transaction — the request's for the preview, the export
 * job's tenant unit of work on the worker: they share its connection, and a dozen short reads are not what a document
 * waits on.
 */
export class ComposeReportDocument {
  constructor(
    private readonly reports: Pick<ReportStore, 'findReport'>,
    private readonly steps: Pick<ReadWizardStep, 'modules' | 'step' | 'evaluationScope'>,
    private readonly prior: Pick<ReadPriorPeriodValues, 'read'>,
    private readonly figures: Pick<ReadCalcFigures, 'execute'>,
    private readonly validation: Pick<RunValidation, 'read'>,
    private readonly precision: PresentationPrecision,
    private readonly labels: Pick<DisclosureLabelResolver, 'standing'>,
  ) {}

  async execute(query: ComposeReportDocumentQuery): Promise<ReportDocument> {
    const { reportId, locale } = query;
    // First, so an unknown report answers 404 before anything else is read.
    const report = await this.reports.findReport({ reportId });
    if (!report) throw new ReportNotFoundError();
    const modules = await this.steps.modules({ reportId, locale });
    const steps = new Map<string, readonly DisclosureField[]>();
    for (const module of modulesToRead({ scope: report.scope, modules })) {
      steps.set(module, (await this.steps.step({ reportId, module, locale })).fields);
    }
    const { scope } = await this.steps.evaluationScope({ reportId });
    const prior = await this.prior.read({ reportId });
    const { latestRun } = await this.figures.execute({ reportId });
    const validation = await this.validation.read({ reportId });

    return assembleReportDocument({
      locale,
      report: {
        ...report.subject,
        scope: report.scope,
        templateVersion: report.templateVersion,
        taxonomyVersion: report.taxonomyVersion,
        reportingCurrency: report.reportingCurrency,
      },
      modules,
      steps,
      inScope: new Set(scope.keys()),
      prior,
      run:
        latestRun === null
          ? null
          : {
              factorSet: latestRun.pinned?.label ?? null,
              results: new Map(
                latestRun.results.flatMap((result) =>
                  result.tonnesCo2e === null ? [] : [[result.elementKey, result.tonnesCo2e] as const],
                ),
              ),
            },
      findings: validation.run === null ? null : validation.findings,
      places: this.precision.places(),
      labelStanding: this.labels.standing({ version: report.taxonomyVersion, locale }),
      production: query.production,
    });
  }
}

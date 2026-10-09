import type { Locale } from '@easyesg/i18n';
import type { PresentationPrecision } from '@api/contracts/presentation-precision.port';
import type { ReportDocumentRenderer } from '@api/contracts/report-document.port';
import type { ReadCalcFigures } from '@api/modules/core/calculator/use-cases/read-calc-figures.use-case';
import type { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import type { Report } from '@api/modules/core/disclosure/models/report.model';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import type { ReadWizardStep } from '@api/modules/core/disclosure/use-cases/read-wizard-step.use-case';
import type { RunValidation } from '@api/modules/core/validation/use-cases/run-validation.use-case';
import { assembleReportDocument, modulesToRead } from '../domain/report-document';

export interface PreviewReportQuery {
  readonly reportId: string;
  /** The document's language — the export's, chosen on S-10 and opening in the account's export default (182/34). */
  readonly locale: Locale;
}

/**
 * UC-41 — the assembled report as the export will print it, without generating a file (task 43.1; FR-48; §12.5.6's
 * task-43 row).
 *
 * **It reads what the screens read, and nothing of its own**: the report, every module of it in the document's
 * language through the wizard's own step read, the scope a validation run evaluates, the prior period's values, the
 * latest calculator run and the last validation run. So the document cannot say something S-07, S-08 or S-09 does not.
 * It writes nothing — no file and no export record (FR-48 AC-2).
 *
 * **The reads run one after another**, on the request's one transaction: they share its connection, and a dozen short
 * reads are not what a preview waits on.
 */
export class PreviewReport {
  constructor(
    private readonly reports: { view(reportId: string): Promise<Report> },
    private readonly steps: Pick<ReadWizardStep, 'modules' | 'step' | 'evaluationScope'>,
    private readonly prior: Pick<ReadPriorPeriodValues, 'read'>,
    private readonly figures: Pick<ReadCalcFigures, 'execute'>,
    private readonly validation: Pick<RunValidation, 'read'>,
    private readonly precision: PresentationPrecision,
    private readonly renderer: ReportDocumentRenderer,
  ) {}

  async execute(query: PreviewReportQuery): Promise<string> {
    const { reportId, locale } = query;
    // First, so an unknown report answers 404 before anything else is read.
    const report = await this.reports.view(reportId);
    const modules = await this.steps.modules({ reportId, locale });
    const steps = new Map<string, readonly DisclosureField[]>();
    for (const module of modulesToRead({ scope: report.scope, modules })) {
      steps.set(module, (await this.steps.step({ reportId, module, locale })).fields);
    }
    const { scope } = await this.steps.evaluationScope({ reportId });
    const prior = await this.prior.read({ reportId });
    const { latestRun } = await this.figures.execute({ reportId });
    const validation = await this.validation.read({ reportId });

    return this.renderer.render(
      assembleReportDocument({
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
      }),
    );
  }
}

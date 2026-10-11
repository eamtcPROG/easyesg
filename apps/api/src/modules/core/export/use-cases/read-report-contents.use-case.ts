import type { LabelStanding, Locale } from '@easyesg/i18n';
import type { Finding } from '@easyesg/validation';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import type { ElementPrecision, PresentationPrecision } from '@api/contracts/presentation-precision.port';
import type { ReadCalcFigures } from '@api/modules/core/calculator/use-cases/read-calc-figures.use-case';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { ReportStore } from '@api/modules/core/disclosure/interfaces/report-store.interface';
import type { Report } from '@api/modules/core/disclosure/models/report.model';
import type { DisclosureModuleSummary, DisclosureStep } from '@api/modules/core/disclosure/models/wizard-step.model';
import type { ReadWizardStep } from '@api/modules/core/disclosure/use-cases/read-wizard-step.use-case';
import type { RunValidation } from '@api/modules/core/validation/use-cases/run-validation.use-case';
import type { FigurePrecision } from '../domain/figure-precision';
import { modulesToRead } from '../domain/report-document';

/** A report's contents as both of its files read them — the reads the screens already make, in one language. */
export interface ReportContents {
  readonly report: Report;
  /** The registered version's modules in the standard's order, as the wizard's list reads them. */
  readonly modules: readonly DisclosureModuleSummary[];
  /** Each module the files print (`modulesToRead`), its fields and its derivation inputs. */
  readonly steps: ReadonlyMap<string, Pick<DisclosureStep, 'fields' | 'derivationInputs'>>;
  /** The elements a validation run evaluates — what a declared section withholds is not among them. */
  readonly inScope: ReadonlySet<string>;
  /** The latest calculator run: its factor set's label and each computed figure — `null` where none has run. */
  readonly run: { readonly factorSet: string | null; readonly results: ReadonlyMap<string, string> } | null;
  /** The last validation run's findings — `null` where the report has never been checked. */
  readonly findings: readonly Finding[] | null;
  /** The digits each figure is shown to, by unit and — for one computed with no unit — by element (task-46 row (10)). */
  readonly precision: FigurePrecision;
  readonly labelStanding: LabelStanding | null;
}

/**
 * What a report holds, read once for the document and the workbook alike (tasks 43, 44, 46) — so the PDF and the Excel
 * export cannot say different things about one report (NFR-18). Moved out of `ComposeReportDocument` by task 46, which
 * gave it its second reader.
 *
 * **It reads what the screens read, and nothing of its own**: the report, every module of it in the files' language
 * through the wizard's own step read, the scope a validation run evaluates, the latest calculator run and the last
 * validation run, and whose words the labels are at the report's pinned version (UX-98). It writes nothing.
 *
 * **The reads run one after another**, on the caller's one transaction — the request's for the preview, the export
 * job's tenant unit of work on the worker: they share its connection, and a dozen short reads are not what a file
 * waits on.
 */
export class ReadReportContents {
  constructor(
    private readonly reports: Pick<ReportStore, 'findReport'>,
    private readonly steps: Pick<ReadWizardStep, 'modules' | 'step' | 'evaluationScope'>,
    private readonly figures: Pick<ReadCalcFigures, 'execute'>,
    private readonly validation: Pick<RunValidation, 'read'>,
    private readonly precision: PresentationPrecision,
    private readonly labels: Pick<DisclosureLabelResolver, 'standing'>,
    private readonly elementPrecision: ElementPrecision,
  ) {}

  async execute(query: { readonly reportId: string; readonly locale: Locale }): Promise<ReportContents> {
    const { reportId, locale } = query;
    // First, so an unknown report answers 404 before anything else is read.
    const report = await this.reports.findReport({ reportId });
    if (!report) throw new ReportNotFoundError();
    const modules = await this.steps.modules({ reportId, locale });
    const steps = new Map<string, Pick<DisclosureStep, 'fields' | 'derivationInputs'>>();
    for (const module of modulesToRead({ scope: report.scope, modules })) {
      const { fields, derivationInputs } = await this.steps.step({ reportId, module, locale });
      steps.set(module, { fields, derivationInputs });
    }
    const { scope } = await this.steps.evaluationScope({ reportId });
    const { latestRun } = await this.figures.execute({ reportId });
    const validation = await this.validation.read({ reportId });

    return {
      report,
      modules,
      steps,
      inScope: new Set(scope.keys()),
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
      precision: { units: this.precision.places(), elements: this.elementPrecision.elementPlaces() },
      labelStanding: this.labels.standing({ version: report.taxonomyVersion, locale }),
    };
  }
}

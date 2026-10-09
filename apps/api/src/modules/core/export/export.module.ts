import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { PRESENTATION_PRECISION, type PresentationPrecision } from '@api/contracts/presentation-precision.port';
import { REPORT_DOCUMENT_RENDERER, type ReportDocumentRenderer } from '@api/contracts/report-document.port';
import { DocumentModule } from '@api/infrastructure/adapters/document/document.module';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';
import { CalculatorModule } from '../calculator/calculator.module';
import { ReadCalcFigures } from '../calculator/use-cases/read-calc-figures.use-case';
import { ComparativesModule } from '../comparatives/comparatives.module';
import { ReadPriorPeriodValues } from '../comparatives/use-cases/read-prior-period-values.use-case';
import { DisclosureModule } from '../disclosure/disclosure.module';
import { ReportService } from '../disclosure/services/report.service';
import { ReadWizardStep } from '../disclosure/use-cases/read-wizard-step.use-case';
import { ValidationModule } from '../validation/validation.module';
import { RunValidation } from '../validation/use-cases/run-validation.use-case';
import { PreviewController } from './controllers/preview.controller';
import { PreviewService } from './services/preview.service';
import { PreviewReport } from './use-cases/preview-report.use-case';

/**
 * `core/export` — FR-48 … FR-53
 *
 * Preview and export orchestration. **Since task 43.1 the preview** (UC-41): the report assembled from the reads the
 * screens make and rendered through `REPORT_DOCUMENT_RENDERER`, answered as the document itself. Exports are always
 * 202 + job id (AD-10), enqueued through the outbox, and arrive with task 44 — on the worker, through the same renderer.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  PreviewService,
  {
    provide: PreviewReport,
    inject: [
      ReportService,
      ReadWizardStep,
      ReadPriorPeriodValues,
      ReadCalcFigures,
      RunValidation,
      PRESENTATION_PRECISION,
      REPORT_DOCUMENT_RENDERER,
    ],
    useFactory: (
      reports: ReportService,
      steps: ReadWizardStep,
      prior: ReadPriorPeriodValues,
      figures: ReadCalcFigures,
      validation: RunValidation,
      precision: PresentationPrecision,
      renderer: ReportDocumentRenderer,
    ) => new PreviewReport(reports, steps, prior, figures, validation, precision, renderer),
  },
];

@Module({
  imports:
    mode === APP_MODE.WORKER
      ? []
      : [DisclosureModule, ComparativesModule, CalculatorModule, ValidationModule, LocalizationModule, DocumentModule],
  controllers: mode === APP_MODE.WORKER ? [] : [PreviewController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class ExportModule {}

import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { OBJECT_STORAGE, type ObjectStorage } from '@api/contracts/object-storage.port';
import { PDF_RENDERER, type PdfRenderer } from '@api/contracts/pdf-renderer.port';
import { PRESENTATION_PRECISION, type PresentationPrecision } from '@api/contracts/presentation-precision.port';
import { REPORT_DOCUMENT_RENDERER, type ReportDocumentRenderer } from '@api/contracts/report-document.port';
import { TENANT_WORK, type TenantWork } from '@api/contracts/tenant-work.port';
import { DocumentModule } from '@api/infrastructure/adapters/document/document.module';
import { ObjectStorageModule } from '@api/infrastructure/adapters/object-storage/object-storage.module';
import { RendererModule } from '@api/infrastructure/adapters/renderer/renderer.module';
import { ExportArtifactStoreRepository } from '@api/infrastructure/persistence/core/export-artifact-store.repository';
import { WorkerTenantWork } from '@api/infrastructure/persistence/worker-tenant-work';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';
import { CalculatorModule } from '../calculator/calculator.module';
import { ReadCalcFigures } from '../calculator/use-cases/read-calc-figures.use-case';
import { ComparativesModule } from '../comparatives/comparatives.module';
import { ReadPriorPeriodValues } from '../comparatives/use-cases/read-prior-period-values.use-case';
import { DisclosureModule } from '../disclosure/disclosure.module';
import { REPORT_STORE, type ReportStore } from '../disclosure/interfaces/report-store.interface';
import { ReadWizardStep } from '../disclosure/use-cases/read-wizard-step.use-case';
import { ValidationModule } from '../validation/validation.module';
import { RunValidation } from '../validation/use-cases/run-validation.use-case';
import { PdfExportRequestedHandler } from './consumers/pdf-export-requested.handler';
import { PreviewController } from './controllers/preview.controller';
import { EXPORT_ARTIFACT_STORE, type ExportArtifactStore } from './interfaces/export-artifact-store.interface';
import { PreviewService } from './services/preview.service';
import { ComposeReportDocument } from './use-cases/compose-report-document.use-case';
import { PreviewReport } from './use-cases/preview-report.use-case';
import { ProducePdfExport } from './use-cases/produce-pdf-export.use-case';

/**
 * `core/export` — FR-48 … FR-53
 *
 * Preview and export orchestration. **The report's document is composed once, in both modes** (`ComposeReportDocument`)
 * and rendered through `REPORT_DOCUMENT_RENDERER`: on the HTTP side it is the preview (UC-41, task 43.1), answered as
 * the document itself; on the worker it is the PDF export's job (UC-42, task 44.2), which prints the same markup on the
 * renderer service, stores the file and settles the export's record. Nothing renders a PDF in the request tier
 * (DR-10, AD-10) — the request half, 202 and a job id through the outbox, is task 47.4's.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const composition: Provider = {
  provide: ComposeReportDocument,
  inject: [
    REPORT_STORE,
    ReadWizardStep,
    ReadPriorPeriodValues,
    ReadCalcFigures,
    RunValidation,
    PRESENTATION_PRECISION,
    DISCLOSURE_LABELS,
  ],
  useFactory: (
    reports: ReportStore,
    steps: ReadWizardStep,
    prior: ReadPriorPeriodValues,
    figures: ReadCalcFigures,
    validation: RunValidation,
    precision: PresentationPrecision,
    labels: DisclosureLabelResolver,
  ) => new ComposeReportDocument(reports, steps, prior, figures, validation, precision, labels),
};

const httpProviders: Provider[] = [
  PreviewService,
  {
    provide: PreviewReport,
    inject: [ComposeReportDocument, REPORT_DOCUMENT_RENDERER],
    useFactory: (compose: ComposeReportDocument, renderer: ReportDocumentRenderer) => new PreviewReport(compose, renderer),
  },
];

/** The PDF export's job (task 44.2): its record, one organization's unit of work at a time, and what it calls. */
const workerProviders: Provider[] = [
  { provide: EXPORT_ARTIFACT_STORE, useClass: ExportArtifactStoreRepository },
  { provide: TENANT_WORK, useClass: WorkerTenantWork },
  {
    provide: ProducePdfExport,
    inject: [
      TENANT_WORK,
      EXPORT_ARTIFACT_STORE,
      ComposeReportDocument,
      REPORT_DOCUMENT_RENDERER,
      PDF_RENDERER,
      OBJECT_STORAGE,
    ],
    useFactory: (
      tenantWork: TenantWork,
      store: ExportArtifactStore,
      compose: ComposeReportDocument,
      documents: ReportDocumentRenderer,
      printer: PdfRenderer,
      storage: ObjectStorage,
    ) => new ProducePdfExport(tenantWork, store, compose, documents, printer, storage, () => new Date()),
  },
  PdfExportRequestedHandler,
];

@Module({
  imports: [
    DisclosureModule,
    ComparativesModule,
    CalculatorModule,
    ValidationModule,
    LocalizationModule,
    DocumentModule,
    ...(mode === APP_MODE.WORKER ? [RendererModule, ObjectStorageModule] : []),
  ],
  controllers: mode === APP_MODE.WORKER ? [] : [PreviewController],
  providers: [composition, ...(mode === APP_MODE.WORKER ? workerProviders : httpProviders)],
})
export class ExportModule {}

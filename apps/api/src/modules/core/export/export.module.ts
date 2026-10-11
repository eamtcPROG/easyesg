import { createHash, randomUUID } from 'node:crypto';
import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { DIGITAL_TEMPLATE_REGISTRY, type DigitalTemplateRegistry } from '@api/contracts/digital-template-registry.port';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { NOTIFICATION_PORT, type NotificationPort } from '@api/contracts/notification.port';
import { OBJECT_READER, OBJECT_STORAGE, type ObjectReader, type ObjectStorage } from '@api/contracts/object-storage.port';
import { PDF_RENDERER, type PdfRenderer } from '@api/contracts/pdf-renderer.port';
import {
  ELEMENT_PRECISION,
  type ElementPrecision,
  PRESENTATION_PRECISION,
  type PresentationPrecision,
} from '@api/contracts/presentation-precision.port';
import { REPORT_DOCUMENT_RENDERER, type ReportDocumentRenderer } from '@api/contracts/report-document.port';
import { REPORT_WORKBOOK_WRITER, type ReportWorkbookWriter } from '@api/contracts/report-workbook.port';
import { TENANT_WORK, type TenantWork } from '@api/contracts/tenant-work.port';
import { DocumentModule } from '@api/infrastructure/adapters/document/document.module';
import { ObjectStorageModule } from '@api/infrastructure/adapters/object-storage/object-storage.module';
import { RendererModule } from '@api/infrastructure/adapters/renderer/renderer.module';
import { WorkbookModule } from '@api/infrastructure/adapters/workbook/workbook.module';
import { EntityIdentifiersRepository } from '@api/infrastructure/persistence/core/entity-identifiers.repository';
import { ExportArtifactStoreRepository } from '@api/infrastructure/persistence/core/export-artifact-store.repository';
import { ExportHistoryRepository } from '@api/infrastructure/persistence/core/export-history.repository';
import { WorkerTenantWork } from '@api/infrastructure/persistence/worker-tenant-work';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
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
import { XlsxExportRequestedHandler } from './consumers/xlsx-export-requested.handler';
import { ExportsController } from './controllers/exports.controller';
import { PreviewController } from './controllers/preview.controller';
import { EXPORT_HISTORY, type ExportHistoryStore } from './interfaces/export-history.interface';
import { ExportService } from './services/export.service';
import { ReadExportFile } from './use-cases/read-export-file.use-case';
import { RequestExport } from './use-cases/request-export.use-case';
import { ENTITY_IDENTIFIERS, type EntityIdentifiersStore } from './interfaces/entity-identifiers.interface';
import { EXPORT_ARTIFACT_STORE, type ExportArtifactStore } from './interfaces/export-artifact-store.interface';
import { PreviewService } from './services/preview.service';
import { ComposeReportDocument } from './use-cases/compose-report-document.use-case';
import { ComposeReportWorkbook } from './use-cases/compose-report-workbook.use-case';
import { PreviewReport } from './use-cases/preview-report.use-case';
import { ProducePdfExport } from './use-cases/produce-pdf-export.use-case';
import { ProduceXlsxExport } from './use-cases/produce-xlsx-export.use-case';
import { ReadReportContents } from './use-cases/read-report-contents.use-case';

/**
 * `core/export` — FR-48 … FR-53
 *
 * Preview and export orchestration. **A report is read once for every file** (`ReadReportContents`), in both modes:
 * composed as its document (`ComposeReportDocument`) and rendered through `REPORT_DOCUMENT_RENDERER` — on the HTTP side
 * the preview (UC-41, task 43.1), on the worker the PDF export's job (UC-42, task 44.2), which prints the same markup on
 * the renderer service — and, since task 46, composed for the EFRAG Digital Template (`ComposeReportWorkbook`) and
 * written into the binary its pin names by the Excel export's job (UC-43). Each job stores its file and settles the
 * export's record by one rule (`runExportAttempt`). Nothing renders or patches in the request tier (DR-10, AD-10) —
 * the request half, 202 and a job id through the outbox, is task 47.4's.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const reading: Provider[] = [
  {
    provide: ReadReportContents,
    inject: [REPORT_STORE, ReadWizardStep, ReadCalcFigures, RunValidation, PRESENTATION_PRECISION, DISCLOSURE_LABELS, ELEMENT_PRECISION],
    useFactory: (
      reports: ReportStore,
      steps: ReadWizardStep,
      figures: ReadCalcFigures,
      validation: RunValidation,
      precision: PresentationPrecision,
      labels: DisclosureLabelResolver,
      elementPrecision: ElementPrecision,
    ) => new ReadReportContents(reports, steps, figures, validation, precision, labels, elementPrecision),
  },
  {
    provide: ComposeReportDocument,
    inject: [ReadReportContents, ReadPriorPeriodValues],
    useFactory: (contents: ReadReportContents, prior: ReadPriorPeriodValues) => new ComposeReportDocument(contents, prior),
  },
];

const httpProviders: Provider[] = [
  PreviewService,
  // S-11's api (tasks 47.1, 47.4): the request, the history, one export and its file.
  ExportService,
  { provide: EXPORT_HISTORY, useClass: ExportHistoryRepository },
  {
    provide: RequestExport,
    inject: [EXPORT_HISTORY],
    useFactory: (history: ExportHistoryStore) => new RequestExport(history, () => randomUUID()),
  },
  {
    provide: ReadExportFile,
    inject: [EXPORT_HISTORY, OBJECT_READER],
    useFactory: (history: ExportHistoryStore, files: ObjectReader) =>
      new ReadExportFile(history, files, (body) => createHash('sha256').update(body).digest('hex')),
  },
  {
    provide: PreviewReport,
    inject: [ComposeReportDocument, REPORT_DOCUMENT_RENDERER],
    useFactory: (compose: ComposeReportDocument, renderer: ReportDocumentRenderer) => new PreviewReport(compose, renderer),
  },
];

/** The export jobs (tasks 44.2, 46.1): their record, one organization's unit of work at a time, and what each calls. */
const workerProviders: Provider[] = [
  { provide: EXPORT_ARTIFACT_STORE, useClass: ExportArtifactStoreRepository },
  { provide: ENTITY_IDENTIFIERS, useClass: EntityIdentifiersRepository },
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
      NOTIFICATION_PORT,
    ],
    useFactory: (
      tenantWork: TenantWork,
      store: ExportArtifactStore,
      compose: ComposeReportDocument,
      documents: ReportDocumentRenderer,
      printer: PdfRenderer,
      storage: ObjectStorage,
      notifications: NotificationPort,
    ) => new ProducePdfExport(tenantWork, store, compose, documents, printer, storage, notifications, () => new Date()),
  },
  {
    provide: ComposeReportWorkbook,
    inject: [ReadReportContents, ENTITY_IDENTIFIERS],
    useFactory: (contents: ReadReportContents, identifiers: EntityIdentifiersStore) => new ComposeReportWorkbook(contents, identifiers),
  },
  {
    provide: ProduceXlsxExport,
    inject: [
      TENANT_WORK,
      EXPORT_ARTIFACT_STORE,
      ComposeReportWorkbook,
      DIGITAL_TEMPLATE_REGISTRY,
      REPORT_WORKBOOK_WRITER,
      OBJECT_STORAGE,
      NOTIFICATION_PORT,
    ],
    useFactory: (
      tenantWork: TenantWork,
      store: ExportArtifactStore,
      compose: ComposeReportWorkbook,
      templates: DigitalTemplateRegistry,
      writer: ReportWorkbookWriter,
      storage: ObjectStorage,
      notifications: NotificationPort,
    ) => new ProduceXlsxExport(tenantWork, store, compose, templates, writer, storage, notifications, () => new Date()),
  },
  PdfExportRequestedHandler,
  XlsxExportRequestedHandler,
];

@Module({
  imports: [
    DisclosureModule,
    ComparativesModule,
    CalculatorModule,
    ValidationModule,
    // The completion notice the export's job raises on the worker (task 47.3).
    NotificationModule,
    LocalizationModule,
    DocumentModule,
    // Object storage in both modes since task 47.1: the worker stores a file, the request tier reads it back.
    ObjectStorageModule,
    ...(mode === APP_MODE.WORKER ? [RendererModule, TaxonomyModule, WorkbookModule] : []),
  ],
  controllers: mode === APP_MODE.WORKER ? [] : [PreviewController, ExportsController],
  providers: [...reading, ...(mode === APP_MODE.WORKER ? workerProviders : httpProviders)],
})
export class ExportModule {}

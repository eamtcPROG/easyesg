import { Module } from '@nestjs/common';
import { REPORT_DOCUMENT_RENDERER } from '@api/contracts/report-document.port';
import { ReactReportDocumentRenderer } from './react-report-document.renderer';

/** The report document's adapter (task 43), imported by `core/export` — and, with task 44, by the worker's export job. */
@Module({
  providers: [{ provide: REPORT_DOCUMENT_RENDERER, useClass: ReactReportDocumentRenderer }],
  exports: [REPORT_DOCUMENT_RENDERER],
})
export class DocumentModule {}

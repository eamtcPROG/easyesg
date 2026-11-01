import { Module } from '@nestjs/common';
import { REPORT_WORKBOOK_WRITER } from '@api/contracts/report-workbook.port';
import { XlsxReportWorkbookWriter } from './xlsx-report-workbook.writer';

/** The Excel export's adapter (task 46), imported by `core/export` on the worker, where the export's job runs. */
@Module({
  providers: [{ provide: REPORT_WORKBOOK_WRITER, useClass: XlsxReportWorkbookWriter }],
  exports: [REPORT_WORKBOOK_WRITER],
})
export class WorkbookModule {}

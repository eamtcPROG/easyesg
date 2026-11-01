import { Injectable } from '@nestjs/common';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReportDocument, ReportDocumentRenderer } from '@api/contracts/report-document.port';
import { documentStyles } from './document-styles';
import { documentWords } from './document-words';
import { ReportDocumentPage } from './templates/report-document-page';

/**
 * `REPORT_DOCUMENT_RENDERER` — the report's templates rendered to static markup (task 43; §12.5.6's task-43 row, which
 * closed OQ-38). **Static markup is the point**: no script reaches the result, so S-10's frame runs nothing and task
 * 44's Chromium prints exactly what the preview showed. React escapes every value it is given, so a reporter's text
 * that begins with markup prints as text (NFR-70).
 */
@Injectable()
export class ReactReportDocumentRenderer implements ReportDocumentRenderer {
  render(document: ReportDocument): string {
    const page = (
      <ReportDocumentPage document={document} words={documentWords(document.locale)} styles={documentStyles()} />
    );
    return `<!doctype html>${renderToStaticMarkup(page)}`;
  }
}

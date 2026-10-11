import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { ContentsPage } from './contents-page';
import { CoverPage } from './cover-page';
import { ModulePage } from './module-page';
import { OmissionsPage } from './omissions-page';
import { pageFurniture } from './page-furniture';
import { ProvenancePage } from './provenance-page';

/**
 * The whole document, in the order a reader meets it (UX-117): the cover, the contents, the omissions and findings, one
 * page per module in the standard's order, the provenance. Its language is the document's own, its styles and fonts
 * are inside it, and it carries no script.
 */
export function ReportDocumentPage(props: {
  readonly document: ReportDocument;
  readonly words: DocumentWords;
  readonly styles: string;
}) {
  const { document, words } = props;
  return (
    <html lang={document.locale}>
      <head>
        <meta charSet="utf-8" />
        <title>{words.t('title', { undertaking: document.undertaking, year: String(document.fiscalYear) })}</title>
        {/* The document's own stylesheet and fonts — trusted, and the only markup not escaped. */}
        <style dangerouslySetInnerHTML={{ __html: props.styles }} />
        {/* The PDF's page furniture, whose words reach the stylesheet only through `cssString` (NFR-70). */}
        <style dangerouslySetInnerHTML={{ __html: pageFurniture({ document, words }) }} />
      </head>
      <body>
        <main>
          <CoverPage document={document} words={words} />
          <ContentsPage document={document} words={words} />
          <OmissionsPage document={document} words={words} />
          {document.modules.map((module) => (
            <ModulePage key={module.module} module={module} document={document} words={words} />
          ))}
          <ProvenancePage document={document} words={words} />
        </main>
      </body>
    </html>
  );
}

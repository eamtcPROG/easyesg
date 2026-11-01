import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { DOCUMENT_MODULE, type ReportDocument } from '@api/contracts/report-document.port';
import { documentWords } from '../document-words';
import { pageFurniture } from './page-furniture';

const DOCUMENT = {
  locale: 'en',
  undertaking: 'Fornaio "Bellini" SRL',
  fiscalYear: 2026,
  scope: 'basic',
  taxonomyVersion: '2026-05-01',
  modules: [{ module: 'B3', standing: DOCUMENT_MODULE.REPORTED, narrative: [], rows: [] }],
} as unknown as ReportDocument;

describe('pageFurniture (task 44; UX-118)', () => {
  beforeAll(() => initialiseCatalogue());

  it('heads every page after the cover with the undertaking, and foots it with the standard and the counter', () => {
    const css = pageFurniture({ document: DOCUMENT, words: documentWords('en') });
    expect(css).toContain('@top-left { content: "Fornaio \\22 Bellini\\22  SRL · Sustainability report 2026"; }');
    expect(css).toContain('@bottom-left { content: "VSME 2026-05-01 · Basic Module · EN"; }');
    expect(css).toContain('@bottom-right { content: "Page " counter(page) " of " counter(pages); }');
    expect(css).toContain('@page :first { @top-left { content: none; }');
  });

  it('names each section the document forces on its own pages, so a long module carries its name onto the next', () => {
    const css = pageFurniture({ document: DOCUMENT, words: documentWords('en') });
    expect(css).toContain('@page section-B3 { @top-right { content: "B3 · Energy and greenhouse gas emissions"; } }');
    expect(css).toContain('#B3 { page: section-B3; }');
    for (const id of ['contents', 'omissions', 'provenance']) expect(css).toContain(`#${id} { page: section-${id}; }`);
  });

  it('puts the counters where each language’s sentence puts them', () => {
    expect(pageFurniture({ document: DOCUMENT, words: documentWords('ru') })).toContain(
      '@bottom-right { content: "Страница " counter(page) " из " counter(pages); }',
    );
  });
});

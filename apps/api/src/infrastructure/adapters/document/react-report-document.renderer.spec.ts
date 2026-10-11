import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { DOCUMENT_MODULE, DOCUMENT_VALUE, type DocumentRow, type ReportDocument } from '@api/contracts/report-document.port';
import { ReactReportDocumentRenderer } from './react-report-document.renderer';

const row = (overrides: Partial<DocumentRow>): DocumentRow => ({
  label: 'Total energy consumption',
  member: null,
  value: { kind: DOCUMENT_VALUE.FIGURE, value: '256.384', places: 2 },
  prior: null,
  unit: 'MWh',
  unresolved: false,
  withheld: false,
  override: null,
  ...overrides,
});

const DOCUMENT: ReportDocument = {
  locale: 'en',
  undertaking: 'Fornaio Bellini SRL',
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
  periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
  scope: 'basic',
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  factorSet: 'MD-2026.1',
  priorYear: 2025,
  modules: [
    {
      module: 'B3',
      standing: DOCUMENT_MODULE.REPORTED,
      narrative: [{ label: 'Other information', text: '<script>alert(1)</script> We bake.' }],
      rows: [
        row({ prior: { kind: DOCUMENT_VALUE.FIGURE, value: '252.61', places: 2 } }),
        row({
          label: 'Gross Scope 1 emissions',
          value: { kind: DOCUMENT_VALUE.FIGURE, value: '0.84', places: 2 },
          unit: 'tCO2e',
          override: { superseded: '0.8912', places: 2, reason: 'A van was sub-leased.', person: 'Ana Rusu' },
        }),
        row({ label: 'Water withdrawal', value: { kind: DOCUMENT_VALUE.NOT_AVAILABLE, reason: 'Shared meter' }, unit: 'm3' }),
        row({ label: 'Fines', value: { kind: DOCUMENT_VALUE.NIL_RETURN }, unit: null }),
      ],
    },
    { module: 'B4', standing: DOCUMENT_MODULE.OMITTED, narrative: [], rows: [] },
    { module: 'B6', standing: DOCUMENT_MODULE.RULED_OUT, narrative: [], rows: [] },
  ],
  gaps: [
    {
      module: 'B3',
      label: 'Water withdrawal',
      member: null,
      value: { kind: DOCUMENT_VALUE.NOT_AVAILABLE, reason: 'Shared meter' },
      withheld: false,
    },
  ],
  omittedModules: ['B4'],
  findings: [],
  labelStanding: 'official',
  production: null,
};

describe('ReactReportDocumentRenderer (task 43; FR-48, UX-117 … UX-121)', () => {
  let html: string;

  beforeAll(async () => {
    await initialiseCatalogue();
    html = new ReactReportDocumentRenderer().render(DOCUMENT);
  });

  it('is one whole page in the document’s own language, with no script in it', () => {
    expect(html.startsWith('<!doctype html><html lang="en">')).toBe(true);
    expect(html).not.toMatch(/<script/iu);
    // A reporter's text beginning with markup prints as text (NFR-70).
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; We bake.');
  });

  it('forces the pages a reader meets, in order: cover, contents, omissions, each module, provenance', () => {
    const pages = [...html.matchAll(/<section class="page" id="([^"]+)"/gu)].map(([, id]) => id);
    expect(pages).toEqual(['cover', 'contents', 'omissions', 'B3', 'B4', 'B6', 'provenance']);
  });

  it('words the cover, the module and its table in the document’s language, the comparative beside the figure', () => {
    expect(html).toContain('<title>Fornaio Bellini SRL · Sustainability report 2026</title>');
    // The locale's own range, thin spaces about its dash included.
    expect(html).toMatch(/January 1\s–\sDecember 31, 2026/u);
    expect(html).toContain('Energy and greenhouse gas emissions');
    expect(html).toContain('<th scope="col" class="figure">2026</th><th scope="col" class="figure">2025</th>');
    // Rounded once to the unit's places, laid out in English, beside the prior period's.
    expect(html).toContain('<td class="figure">256.38</td><td class="figure">252.61</td><td class="unit">MWh</td>');
  });

  it('prints a zero, a gap and an omission so that none can be taken for another (UX-119)', () => {
    expect(html).toContain('0<span class="mark mark-nil-return">Nil return</span>');
    expect(html).toContain('<span class="mark mark-not-available">Not available</span><span class="reason">Reason given: Shared meter</span>');
    expect(html).toContain('The undertaking omits this module as classified or sensitive information.');
    // A module the report's answers rule out says so, rather than vanishing from the contents (FR-28).
    expect(html).toContain('This module does not apply to the undertaking, given its answers in B1.');
  });

  it('names who replaced a calculated figure, beside what it superseded and why (UX-43; FR-48 AC-4)', () => {
    expect(html).toContain('<sup>1</sup><span class="mark mark-estimate">Company estimate</span>');
    expect(html).toContain(
      '0.84 is the undertaking&#x27;s figure, given in place of 0.89 calculated by the platform. Reason given: A van was sub-leased. Replaced by Ana Rusu.',
    );
  });

  it('is worded in Romanian and Russian too, figures laid out as each locale writes them', () => {
    const romanian = new ReactReportDocumentRenderer().render({ ...DOCUMENT, locale: 'ro' });
    expect(romanian).toContain('<html lang="ro">');
    expect(romanian).toContain('Energie și emisii de gaze cu efect de seră');
    expect(romanian).toContain('<td class="figure">256,38</td>');
    const russian = new ReactReportDocumentRenderer().render({ ...DOCUMENT, locale: 'ru' });
    expect(russian).toContain('Энергия и выбросы парниковых газов');
    expect(russian).toContain('<td class="unit">МВт·ч</td>');
  });
});

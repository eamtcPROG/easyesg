import type { Finding } from '@easyesg/validation';
import { DOCUMENT_MODULE, DOCUMENT_VALUE } from '@api/contracts/report-document.port';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import { assembleReportDocument, modulesToRead, type DocumentSources } from './report-document';

/** A field as the wizard's step read answers it, answered with nothing unless a case says otherwise. */
function field(overrides: Partial<DisclosureField> & Pick<DisclosureField, 'elementKey'>): DisclosureField {
  return {
    dimensionKey: '',
    dimensionLabel: null,
    origin: 'reported',
    derived: false,
    explanation: null,
    overriddenBy: null,
    ordinal: 0,
    kind: 'numeric',
    periodType: 'duration',
    axes: [],
    repeating: false,
    order: 0,
    label: `Label of ${overrides.elementKey}`,
    labelStanding: null,
    help: null,
    helpStanding: null,
    options: null,
    defaultValue: null,
    valueNumeric: null,
    valueText: null,
    valueBoolean: null,
    valueDate: null,
    unitCode: null,
    unitCodes: [],
    currency: null,
    state: 'ok',
    notAvailableReason: null,
    carriedForward: false,
    fromRecord: false,
    applicable: true,
    applicabilityCause: null,
    ...overrides,
  };
}

function sources(overrides: Partial<DocumentSources> = {}): DocumentSources {
  return {
    locale: 'en',
    report: {
      entityName: 'Fornaio Bellini SRL',
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
      periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
      scope: 'basic',
      templateVersion: '1.3.0',
      taxonomyVersion: '2026-05-01',
      reportingCurrency: 'MDL',
    },
    modules: [{ module: 'B3', applicable: true, omitted: false, applicabilityCause: null }],
    steps: new Map([['B3', []]]),
    inScope: new Set(),
    prior: { availability: 'no_prior_period', prior: null, values: [] },
    run: null,
    findings: null,
    places: {},
    labelStanding: 'official',
    production: null,
    ...overrides,
  };
}

describe('assembleReportDocument (task 43; FR-48, UX-119)', () => {
  it('carries the labels’ standing and the file’s own facts as they stand — none in a preview (task 44; UX-98, NFR-22)', () => {
    expect(assembleReportDocument(sources())).toMatchObject({ labelStanding: 'official', production: null });
    const production = { generatedAt: new Date('2026-10-11T09:30:00Z'), generatedBy: 'Ana Rusu' };
    expect(assembleReportDocument(sources({ labelStanding: 'platform_authored', production }))).toMatchObject({
      labelStanding: 'platform_authored',
      production,
    });
  });

  it('prints a value carried forward exactly as the same value typed in — the mark is the platform’s, never the export’s (FR-47 AC-4)', () => {
    const printed = (carriedForward: boolean) =>
      assembleReportDocument(
        sources({
          steps: new Map([
            ['B3', [field({ elementKey: 'TotalEnergyConsumption', valueNumeric: '256.384', unitCode: 'MWh', carriedForward })]],
          ]),
          inScope: new Set(['TotalEnergyConsumption']),
        }),
      );
    expect(printed(true)).toEqual(printed(false));
  });

  it('prints an answered figure with its unit and the places its unit is rounded to, beside a comparable prior', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [field({ elementKey: 'TotalEnergyConsumption', valueNumeric: '256.384', unitCode: 'MWh' })],
          ],
        ]),
        inScope: new Set(['TotalEnergyConsumption']),
        places: { MWh: 2 },
        prior: {
          availability: 'available',
          prior: { reportId: 'r0', periodId: 'p0', fiscalYear: 2025, taxonomyVersion: '2026-05-01' },
          values: [
            {
              elementKey: 'TotalEnergyConsumption',
              dimensionKey: '',
              ordinal: 0,
              valueNumeric: '252.61',
              valueText: null,
              valueBoolean: null,
              valueDate: null,
              unitCode: 'MWh',
              state: 'ok',
              comparability: 'comparable',
            },
          ],
        },
      }),
    );
    expect(document.priorYear).toBe(2025);
    expect(document.modules[0].rows).toEqual([
      {
        label: 'Label of TotalEnergyConsumption',
        member: null,
        value: { kind: DOCUMENT_VALUE.FIGURE, value: '256.384', places: 2 },
        prior: { kind: DOCUMENT_VALUE.FIGURE, value: '252.61', places: 2 },
        unit: 'MWh',
        unresolved: false,
        withheld: false,
        override: null,
      },
    ]);
  });

  it('leaves the prior out where it is not comparable, and the year out where there is no prior report', () => {
    const answered = field({ elementKey: 'NumberOfEmployees', valueNumeric: '34' });
    const comparable = (comparability: 'comparable' | 'shape_changed') =>
      assembleReportDocument(
        sources({
          steps: new Map([['B3', [answered]]]),
          inScope: new Set(['NumberOfEmployees']),
          prior: {
            availability: 'available',
            prior: { reportId: 'r0', periodId: 'p0', fiscalYear: 2025, taxonomyVersion: '2026-02-01' },
            values: [
              {
                elementKey: 'NumberOfEmployees',
                dimensionKey: '',
                ordinal: 0,
                valueNumeric: '31',
                valueText: null,
                valueBoolean: null,
                valueDate: null,
                unitCode: null,
                state: 'ok',
                comparability,
              },
            ],
          },
        }),
      );
    expect(comparable('shape_changed').modules[0].rows[0].prior).toBeNull();
    expect(comparable('comparable').modules[0].rows[0].prior).toEqual({
      kind: DOCUMENT_VALUE.FIGURE,
      value: '31',
      places: null,
    });
    const none = assembleReportDocument(sources({ steps: new Map([['B3', [answered]]]), inScope: new Set(['NumberOfEmployees']) }));
    expect(none.priorYear).toBeNull();
    expect(none.modules[0].rows[0].prior).toBeNull();
  });

  it('prints a nil return as a stated zero and a not-available answer with its reason, both among the gaps but the first', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({ elementKey: 'Fines', state: 'nil_return', valueNumeric: '0' }),
              field({ elementKey: 'Water', state: 'not_available', notAvailableReason: 'Shared meter' }),
            ],
          ],
        ]),
        inScope: new Set(['Fines', 'Water']),
      }),
    );
    expect(document.modules[0].rows.map((row) => row.value)).toEqual([
      { kind: DOCUMENT_VALUE.NIL_RETURN },
      { kind: DOCUMENT_VALUE.NOT_AVAILABLE, reason: 'Shared meter' },
    ]);
    // A nil return is an answer, not a gap (FR-30): only the not-available answer is listed with the omissions.
    expect(document.gaps).toEqual([
      {
        module: 'B3',
        label: 'Label of Water',
        member: null,
        value: { kind: DOCUMENT_VALUE.NOT_AVAILABLE, reason: 'Shared meter' },
        withheld: false,
      },
    ]);
  });

  it('prints nothing for an unanswered field, unless a finding names it, and nothing for one that does not apply', () => {
    const finding: Finding = {
      rule: 'b3-required',
      verdict: 'missing_value',
      field: { elementKey: 'Owed', dimensionKey: '', ordinal: 0 },
      related: [],
      message: 'validation.required',
      params: {},
    } as unknown as Finding;
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({ elementKey: 'Blank' }),
              field({ elementKey: 'Owed' }),
              field({ elementKey: 'Ruled', valueNumeric: '4', applicable: false }),
            ],
          ],
        ]),
        inScope: new Set(['Blank', 'Owed']),
        findings: [finding],
      }),
    );
    expect(document.modules[0].rows).toHaveLength(1);
    expect(document.modules[0].rows[0]).toMatchObject({
      label: 'Label of Owed',
      value: { kind: DOCUMENT_VALUE.UNANSWERED },
      unresolved: true,
    });
    expect(document.findings).toEqual([
      { module: 'B3', label: 'Label of Owed', member: null, message: 'validation.required', params: {} },
    ]);
  });

  it('says the report was never checked by holding no findings at all, which is not the same as none', () => {
    expect(assembleReportDocument(sources()).findings).toBeNull();
    expect(assembleReportDocument(sources({ findings: [] })).findings).toEqual([]);
  });

  it('prints a narrative block under its label rather than as a figure', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([['B3', [field({ elementKey: 'Practices', kind: 'text_block', valueText: 'We bake.' })]]]),
        inScope: new Set(['Practices']),
      }),
    );
    expect(document.modules[0].narrative).toEqual([{ label: 'Label of Practices', text: 'We bake.' }]);
    expect(document.modules[0].rows).toEqual([]);
  });

  it('prints an overridden figure with the computed figure it superseded, the reason and the person', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({
                elementKey: 'GrossScopeOneGreenhouseGasEmissions',
                valueNumeric: '0.84',
                unitCode: 'tCO2e',
                origin: 'overridden',
                explanation: 'A van was sub-leased.',
                overriddenBy: { accountId: 'a1', name: 'Ana Rusu' },
              }),
            ],
          ],
        ]),
        inScope: new Set(['GrossScopeOneGreenhouseGasEmissions']),
        run: {
          factorSet: 'MD-2026.1',
          results: new Map([['GrossScopeOneGreenhouseGasEmissions', '0.8912']]),
        },
        places: { tCO2e: 2 },
      }),
    );
    expect(document.factorSet).toBe('MD-2026.1');
    expect(document.modules[0].rows[0].override).toEqual({
      superseded: '0.8912',
      places: 2,
      reason: 'A van was sub-leased.',
      person: 'Ana Rusu',
    });
  });

  it('gives every module the scope asks a page: omitted, ruled out, or owed while B1 has not said', () => {
    const cause = (answer: string | null) =>
      ({ condition: 'member_within', drivers: [], threshold: null, answer }) as unknown as DocumentSources['modules'][number]['applicabilityCause'];
    const modules: DocumentSources['modules'] = [
      { module: 'B4', applicable: true, omitted: true, applicabilityCause: null },
      { module: 'B5', applicable: false, omitted: false, applicabilityCause: cause('nace:NACE_G') },
      { module: 'B6', applicable: false, omitted: false, applicabilityCause: cause(null) },
      { module: 'C1', applicable: true, omitted: false, applicabilityCause: null },
    ];
    // Only the owed module's fields are read: the omitted and the ruled-out one print none, and a Basic report asks no C1.
    expect(modulesToRead({ scope: 'basic', modules })).toEqual(['B6']);
    const document = assembleReportDocument(
      sources({
        modules,
        steps: new Map([['B6', [field({ elementKey: 'Water', valueNumeric: '3', applicable: false })]]]),
        inScope: new Set(),
      }),
    );
    expect(document.modules).toEqual([
      { module: 'B4', standing: DOCUMENT_MODULE.OMITTED, narrative: [], rows: [] },
      { module: 'B5', standing: DOCUMENT_MODULE.RULED_OUT, narrative: [], rows: [] },
      { module: 'B6', standing: DOCUMENT_MODULE.REPORTED, narrative: [], rows: [] },
    ]);
    expect(document.omittedModules).toEqual(['B4']);
    // A report that asks the Comprehensive Module gives C1 its page too.
    expect(modulesToRead({ scope: 'basic_and_comprehensive', modules })).toEqual(['B6', 'C1']);
  });

  it('prints a disclosure a declared section withholds once, with the omission and no value', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({ elementKey: 'Secret', dimensionKey: 'A', dimensionLabel: 'A', valueNumeric: '1' }),
              field({ elementKey: 'Secret', dimensionKey: 'B', dimensionLabel: 'B', valueNumeric: '2' }),
            ],
          ],
        ]),
        inScope: new Set(),
      }),
    );
    expect(document.modules[0].rows).toEqual([
      {
        label: 'Label of Secret',
        member: null,
        value: { kind: DOCUMENT_VALUE.UNANSWERED },
        prior: null,
        unit: null,
        unresolved: false,
        withheld: true,
        override: null,
      },
    ]);
    expect(document.gaps).toEqual([{ module: 'B3', label: 'Label of Secret', member: null, value: null, withheld: true }]);
  });

  it('prints a choice by its options’ labels, a set in the order chosen, and a code where no label is published', () => {
    const options = [
      { value: 'MD', label: null, code: 'MD', hazardous: null },
      { value: 'Paper', label: 'Paper and cardboard', code: null, hazardous: null },
      { value: 'Glass', label: 'Glass', code: null, hazardous: null },
    ];
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({ elementKey: 'Country', kind: 'enumeration', options, valueText: 'MD' }),
              field({ elementKey: 'Streams', kind: 'enumeration_set', options, valueText: 'Glass Paper' }),
            ],
          ],
        ]),
        inScope: new Set(['Country', 'Streams']),
      }),
    );
    expect(document.modules[0].rows.map((row) => row.value)).toEqual([
      { kind: DOCUMENT_VALUE.CHOICES, labels: ['MD'] },
      { kind: DOCUMENT_VALUE.CHOICES, labels: ['Glass', 'Paper and cardboard'] },
    ]);
  });

  it('prints single disclosures first, then each repeating row in its order — a site’s fields together', () => {
    const document = assembleReportDocument(
      sources({
        steps: new Map([
          [
            'B3',
            [
              field({ elementKey: 'Address', repeating: true, ordinal: 1, order: 1, dimensionLabel: 'Depot', valueText: 'Ialoveni', kind: 'text' }),
              field({ elementKey: 'Address', repeating: true, ordinal: 0, order: 1, dimensionLabel: 'Bakery', valueText: 'Chișinău', kind: 'text' }),
              field({ elementKey: 'Turnover', order: 2, kind: 'monetary', valueNumeric: '28200000', currency: 'MDL' }),
            ],
          ],
        ]),
        inScope: new Set(['Address', 'Turnover']),
      }),
    );
    expect(document.modules[0].rows.map((row) => [row.label, row.member])).toEqual([
      ['Label of Turnover', null],
      ['Label of Address', 'Bakery'],
      ['Label of Address', 'Depot'],
    ]);
    expect(document.modules[0].rows[0].value).toEqual({
      kind: DOCUMENT_VALUE.MONEY,
      value: '28200000',
      places: null,
      currency: 'MDL',
    });
  });
});

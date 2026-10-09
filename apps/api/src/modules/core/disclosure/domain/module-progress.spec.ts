import { APPLICABILITY_CONDITION, type EvaluatedApplicability } from '../models/applicability.model';
import { aLabel, aStoredValue, anElement } from '../testing/step-read.fakes';
import { moduleSummaries } from './module-progress';
import { indexStored } from './stored-values';

/**
 * Task 133.2: the module list's progress, applicability and omission, over handed-in reads. Every rule here was
 * reachable only through `wizard.e2e-spec.ts` while it sat inside the use case.
 */
const ruledOut = (driver: string, answer: string | null): EvaluatedApplicability => ({
  applicable: false,
  cause: { condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST, driverKeys: [driver], threshold: '50', answer },
});

const summaries = (over: Partial<Parameters<typeof moduleSummaries>[0]> = {}) =>
  moduleSummaries({
    elements: [],
    moduleOrder: ['B1', 'B3', 'B8', 'C3'],
    applicability: new Map(),
    byElement: new Map(),
    catalogue: null,
    omitted: new Set(),
    ...over,
  });

describe('moduleSummaries', () => {
  it('counts an element answered when any of its rows is, once, and dates the module by its latest answer', () => {
    const { byElement } = indexStored([
      aStoredValue({ elementKey: 'AddressOfSite', ordinal: 0, valueText: 'Str. Unu', updatedAt: 1_000 }),
      aStoredValue({ elementKey: 'AddressOfSite', ordinal: 1, valueText: 'Str. Doi', updatedAt: 3_000 }),
      // A row holding nothing is no answer, and does not move where work last happened.
      aStoredValue({ elementKey: 'CityOfSite', ordinal: 0, valueText: null, updatedAt: 9_000 }),
    ]);

    const [b1] = summaries({
      elements: [anElement({ key: 'AddressOfSite' }), anElement({ key: 'CityOfSite' }), anElement({ key: 'Turnover' })],
      byElement,
    });

    expect(b1).toEqual({
      module: 'B1',
      answered: 1,
      total: 3,
      lastAnsweredAt: 3_000,
      applicable: true,
      applicabilityCause: null,
      omitted: false,
    });
  });

  it('counts a shared element into every module that presents it', () => {
    const { byElement } = indexStored([aStoredValue({ elementKey: 'GrossScope1', valueNumeric: '12.5' })]);

    const result = summaries({ elements: [anElement({ key: 'GrossScope1', modules: ['B3', 'C3'] })], byElement });

    expect(result.map(({ module, answered, total }) => ({ module, answered, total }))).toEqual([
      { module: 'B3', answered: 1, total: 1 },
      { module: 'C3', answered: 1, total: 1 },
    ]);
  });

  it('answers in the taxonomy’s module order, and leaves out a module no element presents', () => {
    const result = summaries({
      elements: [
        anElement({ key: 'Turnover', modules: ['B8'] }),
        anElement({ key: 'NumberOfEmployees', modules: ['B1'] }),
        // A pillar-level catch-all presents in no module and is counted into none.
        anElement({ key: 'EnvironmentalCatchAll', modules: [] }),
      ],
    });

    expect(result.map((summary) => summary.module)).toEqual(['B1', 'B8']);
  });

  it('counts a ruled-out element into neither side, and words the cause of a module that has gone whole', () => {
    const result = summaries({
      elements: [
        anElement({ key: 'NumberOfEmployees', modules: ['B1'] }),
        anElement({ key: 'EmployeeTurnoverRate', modules: ['B8'] }),
        anElement({ key: 'AverageNumberOfEmployees', modules: ['B8'] }),
      ],
      applicability: new Map([
        ['EmployeeTurnoverRate', ruledOut('NumberOfEmployees', '40')],
        ['AverageNumberOfEmployees', ruledOut('NumberOfEmployees', '40')],
      ]),
      catalogue: { NumberOfEmployees: aLabel('Număr de angajați') },
    });

    expect(result.find((summary) => summary.module === 'B8')).toEqual({
      module: 'B8',
      answered: 0,
      total: 0,
      lastAnsweredAt: null,
      applicable: false,
      applicabilityCause: {
        condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
        drivers: [{ elementKey: 'NumberOfEmployees', label: 'Număr de angajați' }],
        threshold: '50',
        answer: '40',
      },
      omitted: false,
    });
  });

  it('gives no cause to a module its elements left for different reasons', () => {
    const [b8] = summaries({
      elements: [
        anElement({ key: 'EmployeeTurnoverRate', modules: ['B8'] }),
        anElement({ key: 'PayGap', modules: ['B8'] }),
      ],
      applicability: new Map([
        ['EmployeeTurnoverRate', ruledOut('NumberOfEmployees', '40')],
        ['PayGap', ruledOut('NumberOfEmployees', null)],
      ]),
    });

    expect(b8).toMatchObject({ module: 'B8', applicable: false, applicabilityCause: null });
  });

  it('keeps a module applicable while any element in it still applies', () => {
    const [b8] = summaries({
      elements: [
        anElement({ key: 'EmployeeTurnoverRate', modules: ['B8'] }),
        anElement({ key: 'Turnover', modules: ['B8'] }),
      ],
      applicability: new Map([['EmployeeTurnoverRate', ruledOut('NumberOfEmployees', '40')]]),
    });

    expect(b8).toMatchObject({ module: 'B8', applicable: true, total: 1, applicabilityCause: null });
  });

  it('marks the modules B1 declares omitted, and only those', () => {
    const result = summaries({
      elements: [
        anElement({ key: 'NumberOfEmployees', modules: ['B1'] }),
        anElement({ key: 'Turnover', modules: ['B8'] }),
      ],
      omitted: new Set(['B8']),
    });

    expect(result.map(({ module, omitted }) => ({ module, omitted }))).toEqual([
      { module: 'B1', omitted: false },
      { module: 'B8', omitted: true },
    ]);
  });
});

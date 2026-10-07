import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DerivationInput,
  type DisclosureField,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { askedFields, askedInputsOf, derivedElements } from './step-applicability';

const field = (over: Partial<DisclosureField> & { elementKey: string }): DisclosureField => ({
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.TEXT,
  periodType: 'instant',
  axes: [],
  repeating: false,
  order: 0,
  label: null,
  labelStanding: null,
  help: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  unitCodes: [],
  state: DISCLOSURE_STATE.MISSING,
  notAvailableReason: null,
  carriedForward: false,
  fromRecord: false,
  applicable: true,
  applicabilityCause: null,
  ...over,
});

const input = (key: string, derives: string): DerivationInput => ({
  key,
  derives,
  value: null,
  offered: null,
});

const turnover = field({ elementKey: 'EmployeeTurnoverRate' });
const headcount = field({ elementKey: 'NumberOfEmployees' });
const left = input('NumberOfEmployeesWhoLeftDuringTheReportingPeriod', 'EmployeeTurnoverRate');
const hours = input('HoursWorkedByOneFullTimeEmployee', 'NumberOfFullTimeEquivalents');

describe('askedFields', () => {
  it('drops a field the api marked not applicable — §7.3: not applicable is not rendered', () => {
    expect(askedFields([headcount, field({ elementKey: 'B10', applicable: false })])).toEqual([headcount]);
  });
});

describe('derivedElements', () => {
  it('names an element derived exactly when the api marks it so', () => {
    const derived = derivedElements([field({ elementKey: 'EmployeeTurnoverRate', derived: true }), headcount]);
    expect(derived.has('EmployeeTurnoverRate')).toBe(true);
    expect(derived.has('NumberOfEmployees')).toBe(false);
  });

  it('names a figure derived from disclosures alone, which no input feeds (task 38.4)', () => {
    // B3's total is Scope 1 plus Scope 2: two fields, no derivation input — read off the inputs it was missed.
    const total = field({ elementKey: 'TotalGrossLocationBasedScope1AndScope2GHGEmissions', derived: true });
    expect(derivedElements([total]).has(total.elementKey)).toBe(true);
  });
});

describe('askedInputsOf', () => {
  it('keeps an input only while the figure it feeds is asked', () => {
    expect(askedInputsOf({ inputs: [left, hours], asked: [turnover, headcount] })).toEqual([left]);
  });

  it('asks nothing for a figure the reporter is not asked for — an input outlives nothing', () => {
    expect(askedInputsOf({ inputs: [left], asked: [headcount] })).toEqual([]);
  });
});

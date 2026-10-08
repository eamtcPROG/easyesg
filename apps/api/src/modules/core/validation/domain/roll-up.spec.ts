import type { FieldValue, Finding } from '@easyesg/validation';
import { COMPLETION_STATUS, completionStatus } from '../models/roll-up.model';
import { rollUp } from './roll-up';

const missing = (elementKey: string): Finding => ({
  rule: `rule-${elementKey}`,
  verdict: 'missing',
  field: { elementKey, dimensionKey: '', ordinal: 0 },
  related: [],
  message: 'validation.required',
  params: {},
});

/**
 * UC-38's roll-up (task 41.3; FR-41; 182/18): what counts, where, and as what — each rule of the count one case.
 */
describe('rollUp (FR-41)', () => {
  const scope = new Map<string, readonly string[]>([
    ['Turnover', ['B1']],
    ['Assets', ['B1']],
    ['NumberOfEmployees', ['B1']],
    ['GrossScope1GreenhouseGasEmissions', ['B3', 'C3']],
    ['TotalSealedArea', ['B5']],
    ['EmployeeTurnoverRate', ['B8']],
    ['NumberOfPermanentContractEmployees', ['B10']],
  ]);
  const MODULES = ['B1', 'B3', 'B5', 'B8', 'B10', 'C3'];

  it('counts an answered field resolved, a declared one reasoned and a flagged one outstanding (AC-4, AC-7)', () => {
    const values: FieldValue[] = [
      { elementKey: 'Turnover', valueNumeric: '100' },
      { elementKey: 'Assets', state: 'not_available' },
    ];
    const rolled = rollUp({ scope, modules: MODULES, values, findings: [missing('NumberOfEmployees')] });
    expect(rolled.report).toEqual({ resolved: 1, reasoned: 1, outstanding: 1 });
    expect(rolled.modules.find((module) => module.module === 'B1')).toEqual({
      module: 'B1',
      resolved: 1,
      reasoned: 1,
      outstanding: 1,
      outstandingFields: [{ elementKey: 'NumberOfEmployees', dimensionKey: '', ordinal: 0 }],
    });
  });

  it('counts a field with a finding as outstanding however it is answered — a range error on a stored figure', () => {
    const rolled = rollUp({
      scope,
      modules: MODULES,
      values: [{ elementKey: 'Turnover', valueNumeric: '-5' }],
      findings: [{ ...missing('Turnover'), verdict: 'error' }],
    });
    expect(rolled.report).toEqual({ resolved: 0, reasoned: 0, outstanding: 1 });
  });

  it('counts an unanswered field nothing flags nowhere, and an emptied row likewise', () => {
    const rolled = rollUp({ scope, modules: MODULES, values: [{ elementKey: 'TotalSealedArea', valueNumeric: null }], findings: [] });
    expect(rolled.report).toEqual({ resolved: 0, reasoned: 0, outstanding: 0 });
  });

  it('counts nothing outside the scope — a ruled-out or withheld field (AC-2, AC-3)', () => {
    const rolled = rollUp({ scope, modules: MODULES, values: [{ elementKey: 'TotalWaterConsumption', valueNumeric: '5' }], findings: [] });
    expect(rolled.report).toEqual({ resolved: 0, reasoned: 0, outstanding: 0 });
  });

  it('counts an element B3 and C3 share in each module, and once in the report', () => {
    const rolled = rollUp({
      scope,
      modules: MODULES,
      values: [{ elementKey: 'GrossScope1GreenhouseGasEmissions', valueNumeric: '12.5' }],
      findings: [],
    });
    expect(rolled.report.resolved).toBe(1);
    expect(rolled.modules.filter((module) => module.resolved === 1).map((module) => module.module)).toEqual([
      'B3',
      'C3',
    ]);
  });

  it('lists the modules it is given, in their order, one nothing touched — or one waiting on B1 — with zero counts', () => {
    const rolled = rollUp({ scope, modules: [...MODULES, 'B6'], values: [], findings: [] });
    expect(rolled.modules.map((module) => module.module)).toEqual([...MODULES, 'B6']);
    expect(rolled.modules.at(-1)).toEqual({ module: 'B6', resolved: 0, reasoned: 0, outstanding: 0, outstandingFields: [] });
  });
});

describe('completionStatus (182/18, 182/19)', () => {
  it('reads not started where nothing is resolved or reasoned, whatever is outstanding', () => {
    expect(completionStatus({ resolved: 0, reasoned: 0, outstanding: 3 })).toBe(COMPLETION_STATUS.NOT_STARTED);
  });

  it('reads in progress while something is outstanding, and complete once nothing is', () => {
    expect(completionStatus({ resolved: 2, reasoned: 0, outstanding: 1 })).toBe(COMPLETION_STATUS.IN_PROGRESS);
    expect(completionStatus({ resolved: 0, reasoned: 1, outstanding: 0 })).toBe(COMPLETION_STATUS.COMPLETE);
  });
});

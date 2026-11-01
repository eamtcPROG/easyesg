import type { FindingField, ValidationFinding } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { findingKey } from './finding-key';
import { PANEL_FILTER, panelFindings } from './panel-findings';

/** S-08's grouping (task 42.2; row (c)): by module in the list's order, weighed, cleared kept in view. */
const place = (elementKey: string, modules: string[]): FindingField => ({
  elementKey,
  dimensionKey: '',
  ordinal: 0,
  label: elementKey,
  memberLabel: null,
  modules,
});

const finding = (rule: string, field: FindingField, verdict: ValidationFinding['verdict'] = 'missing'): ValidationFinding => ({
  rule,
  verdict,
  field,
  related: [],
  message: 'validation.required',
  params: {},
});

const ORDER = ['B1', 'B3', 'B8', 'C3'];
const FINDINGS = [
  finding('b8-gender', place('NumberOfMaleEmployees', ['B8']), 'inconsistency'),
  finding('b1-turnover', place('Turnover', ['B1'])),
  finding('b3-scope', place('GrossScope1GreenhouseGasEmissions', ['C3', 'B3'])),
];

const list = (over: { cleared?: (key: string) => boolean; filter?: (typeof PANEL_FILTER)[keyof typeof PANEL_FILTER] } = {}) =>
  panelFindings({
    findings: FINDINGS,
    moduleOrder: ORDER,
    cleared: over.cleared ?? (() => false),
    filter: over.filter ?? PANEL_FILTER.ALL,
  });

describe('panelFindings', () => {
  it('groups by module in the list’s order, a shared field under its first module, each weighed', () => {
    const { groups, counts } = list();
    expect(groups.map((group) => group.module)).toEqual(['B1', 'B3', 'B8']);
    // The literals are the wire values of `FINDING_WEIGHT`, pinned on purpose.
    expect(groups.map((group) => group.findings.map((entry) => entry.weight))).toEqual([
      ['must_fix'],
      ['must_fix'],
      ['review'],
    ]);
    expect(counts).toEqual({ all: 3, mustFix: 2, review: 1 });
  });

  it('keeps a finding the answers no longer raise, weighed cleared, and counts it in neither weight', () => {
    const [, turnoverFinding] = FINDINGS;
    const turnover = turnoverFinding === undefined ? '' : findingKey(turnoverFinding);
    const { groups, counts } = list({ cleared: (key) => key === turnover });
    expect(groups[0]?.findings[0]?.weight).toBe('cleared');
    expect(counts).toEqual({ all: 3, mustFix: 1, review: 1 });
  });

  it('shows one weight under its filter, and drops a group left empty', () => {
    expect(list({ filter: PANEL_FILTER.REVIEW }).groups.map((group) => group.module)).toEqual(['B8']);
    expect(list({ filter: PANEL_FILTER.MUST_FIX }).groups.map((group) => group.module)).toEqual(['B1', 'B3']);
  });

  it('lists a finding no module in the list presents last, under the module the read named', () => {
    const { groups } = panelFindings({
      findings: [finding('c8', place('Revenue', ['C8']))],
      moduleOrder: ['B1'],
      cleared: () => false,
      filter: PANEL_FILTER.ALL,
    });
    expect(groups.map((group) => group.module)).toEqual(['C8']);
  });
});

import { VERDICT, type FieldValue, type Finding, type RuleSet } from '@easyesg/validation';
import { describe, expect, it } from 'vitest';
import { stepFindings } from './step-findings';

/**
 * Live where the step can evaluate a rule, the last run's word otherwise (task 42.1; OQ-49; §12.5.6's task-42 row (1)).
 * The interpreter's verdicts are the corpus's (task 40.3); what is here is which rules the step answers itself.
 */
const RULES: RuleSet = {
  rules: [
    // Wholly on B1's step.
    { id: 'b1-turnover', kind: 'required', verdict: 'missing', message: 'validation.required', fields: [{ element: 'Turnover' }] },
    // Reaching from B8 to B1's headcount.
    {
      id: 'b8-gender',
      kind: 'sum',
      verdict: 'inconsistency',
      message: 'validation.sum.inconsistent',
      parts: [{ element: 'NumberOfMaleEmployees' }, { element: 'NumberOfFemaleEmployees' }],
      total: { element: 'NumberOfEmployees' },
      relation: 'equal',
    },
  ],
};

const lastRunFinding = (rule: string, element: string): Finding => ({
  rule,
  verdict: VERDICT.MISSING_VALUE,
  field: { elementKey: element, dimensionKey: '', ordinal: 0 },
  related: [],
  message: 'validation.required',
  params: {},
});

const verdicts = (over: { values?: FieldValue[]; lastRun?: Finding[]; step: string[]; scope?: string[] }) =>
  stepFindings({
    rules: { ruleSet: RULES, scope: over.scope ?? ['Turnover', 'NumberOfEmployees', 'NumberOfMaleEmployees', 'NumberOfFemaleEmployees'] },
    stepElements: new Set(over.step),
    values: over.values ?? [],
    prior: [],
    lastRun: over.lastRun ?? [],
  });
const find = (over: Parameters<typeof verdicts>[0]) => verdicts(over).findings;

describe('stepFindings', () => {
  it('evaluates a rule the step holds whole, live, over the answers held', () => {
    expect(find({ step: ['Turnover'] }).map((finding) => finding.rule)).toEqual(['b1-turnover']);
    expect(find({ step: ['Turnover'], values: [{ elementKey: 'Turnover', valueNumeric: '1000' }] })).toEqual([]);
  });

  it('lets a live answer replace the last run’s word about the same rule, never sit beside it', () => {
    const answered = find({
      step: ['Turnover'],
      values: [{ elementKey: 'Turnover', valueNumeric: '1000' }],
      lastRun: [lastRunFinding('b1-turnover', 'Turnover')],
    });
    expect(answered).toEqual([]);
  });

  it('carries the last run’s finding for a rule reaching past the step, which it cannot evaluate', () => {
    // B8's step presents the split, not B1's headcount, so the run answers the sum.
    const shown = find({
      step: ['NumberOfMaleEmployees', 'NumberOfFemaleEmployees'],
      lastRun: [lastRunFinding('b8-gender', 'NumberOfMaleEmployees')],
    });
    expect(shown.map((finding) => finding.rule)).toEqual(['b8-gender']);
  });

  it('narrows to the report’s scope — an element the api ruled out is not evaluated even on its own step', () => {
    expect(find({ step: ['Turnover'], scope: [] })).toEqual([]);
  });

  it('answers the last run alone where the rules could not be read', () => {
    const lastRun = [lastRunFinding('b1-turnover', 'Turnover')];
    expect(
      stepFindings({ rules: null, stepElements: new Set(['Turnover']), values: [], prior: [], lastRun }),
    ).toEqual({ findings: lastRun, cleared: new Set() });
  });

  it('reports a last-run finding the answers no longer raise as cleared, and none it cannot evaluate (task 42.2)', () => {
    const turnover = lastRunFinding('b1-turnover', 'Turnover');
    const gender = lastRunFinding('b8-gender', 'NumberOfMaleEmployees');
    const answered = verdicts({
      step: ['Turnover', 'NumberOfMaleEmployees', 'NumberOfFemaleEmployees'],
      values: [{ elementKey: 'Turnover', valueNumeric: '1000' }],
      lastRun: [turnover, gender],
    });
    expect([...answered.cleared]).toEqual(['b1-turnover\u0000Turnover\u0000\u00000']);
    // Still unanswered, so still raised — not cleared.
    expect(verdicts({ step: ['Turnover'], lastRun: [turnover] }).cleared.size).toBe(0);
  });
});

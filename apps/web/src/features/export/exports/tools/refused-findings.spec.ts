import { PROBLEM_TYPE, type ProblemDocument } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { refusedFindings } from './refused-findings';

const finding = {
  rule: 'b1-turnover',
  verdict: 'missing',
  field: { elementKey: 'Turnover', dimensionKey: '', ordinal: 0, label: 'Annual turnover', memberLabel: null, modules: ['B1'] },
  related: [],
  message: 'validation.required',
  params: {},
};

const refusal = (extensions?: Record<string, unknown>): ProblemDocument => ({
  type: PROBLEM_TYPE.ExportFindingsUnacknowledged,
  status: 409,
  title: 'Unresolved findings',
  ...(extensions === undefined ? {} : { extensions }),
});

/** The refusal's list (task 47.4): read when it is this refusal, and the warning still owed when the list is not readable. */
describe('refusedFindings', () => {
  it('reads the findings the refusal lists', () => {
    expect(refusedFindings(refusal({ findings: [finding] }))).toEqual([finding]);
  });

  it('answers an empty list for this refusal with a list it cannot read — the warning is still owed', () => {
    expect(refusedFindings(refusal())).toEqual([]);
    expect(refusedFindings(refusal({ findings: [{ ...finding, field: 'Turnover' }] }))).toEqual([]);
    expect(refusedFindings(refusal({ findings: 'three' }))).toEqual([]);
  });

  it('answers null for any other refusal', () => {
    expect(refusedFindings({ type: PROBLEM_TYPE.InsufficientRole, status: 403, extensions: { findings: [finding] } })).toBeNull();
  });
});

import { VERDICT, type Finding } from '@easyesg/validation';
import { describe, expect, it } from 'vitest';
import { findingsByField } from './findings-by-field';

describe('findingsByField', () => {
  it('groups by the queue’s key, most severe first — §6.4’s order', () => {
    const at = { elementKey: 'Turnover', dimensionKey: '', ordinal: 0 };
    const missing: Finding = {
      rule: 'a',
      verdict: VERDICT.MISSING_VALUE,
      field: at,
      related: [],
      message: 'validation.required',
      params: {},
    };
    const error: Finding = { ...missing, rule: 'b', verdict: VERDICT.ERROR };
    const inconsistent: Finding = { ...missing, rule: 'c', verdict: VERDICT.VALUE_INCONSISTENCY };
    const grouped = findingsByField([missing, inconsistent, error]);
    expect(grouped.get('Turnover\u0000\u00000')?.map((finding) => finding.rule)).toEqual(['b', 'c', 'a']);
  });
});

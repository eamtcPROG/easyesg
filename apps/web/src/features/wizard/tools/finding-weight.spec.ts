import { VERDICT } from '@easyesg/validation';
import { describe, expect, it } from 'vitest';
import { weightOf } from './finding-weight';

/** S-08's two weights (task 42.2; row (b)). The literals are `FINDING_WEIGHT`'s wire values, pinned on purpose. */
describe('weightOf', () => {
  it('weighs what makes the report wrong or incomplete as must fix, and an inconsistency as review', () => {
    expect(weightOf(VERDICT.MISSING_VALUE)).toBe('must_fix');
    expect(weightOf(VERDICT.ERROR)).toBe('must_fix');
    expect(weightOf(VERDICT.INVALID_URL)).toBe('must_fix');
    expect(weightOf(VERDICT.VALUE_INCONSISTENCY)).toBe('review');
  });
});

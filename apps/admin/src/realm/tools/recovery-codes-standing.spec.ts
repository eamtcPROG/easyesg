import { describe, expect, it } from 'vitest';
import { recoveryCodesStandingOf } from './recovery-codes-standing';

const ISSUED_AT = Date.UTC(2026, 8, 14, 9, 0);

/** A-19's three resting arms (task 151) — the pair a count of zero cannot tell apart on its own. */
describe('recoveryCodesStandingOf', () => {
  it('reads no issue date as first use, whatever the count says', () => {
    expect(recoveryCodesStandingOf({ recoveryCodesIssuedAt: null, recoveryCodesRemaining: 0 })).toEqual({
      kind: 'none_issued',
    });
  });

  it('reads an issued set with nothing left as exhausted, keeping the date it was issued', () => {
    expect(recoveryCodesStandingOf({ recoveryCodesIssuedAt: ISSUED_AT, recoveryCodesRemaining: 0 })).toEqual({
      kind: 'exhausted',
      issuedAt: ISSUED_AT,
    });
  });

  it('counts what remains of an issued set, one code included', () => {
    expect(recoveryCodesStandingOf({ recoveryCodesIssuedAt: ISSUED_AT, recoveryCodesRemaining: 1 })).toEqual({
      kind: 'remaining',
      issuedAt: ISSUED_AT,
      remaining: 1,
    });
  });
});

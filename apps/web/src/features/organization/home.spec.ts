import { describe, expect, it } from 'vitest';
import { MEMBERSHIP_GRANT_KIND } from '@easyesg/contracts';
import { readArrival } from './home';

describe('readArrival (UC-15 → S-05)', () => {
  it('recognises each grant the API can answer', () => {
    // Derived from the vocabulary rather than listed, so a fourth grant fails here before it
    // reaches a screen with no sentence for it.
    for (const grant of Object.values(MEMBERSHIP_GRANT_KIND)) {
      expect(readArrival(grant)).toBe(grant);
    }
  });

  it('says nothing for an absent or edited parameter', () => {
    expect(readArrival(undefined)).toBeNull();
    // The value arrives through the address bar. Announcing "you now have access" to somebody who
    // typed it would state something the product never decided.
    expect(readArrival('congratulations')).toBeNull();
    expect(readArrival([''])).toBeNull();
  });
});

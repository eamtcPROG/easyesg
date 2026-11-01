import { describe, expect, it } from 'vitest';
import { COOKIE_CHOICE_KEPT_MONTHS, COOKIE_POLICY_VERSION_IN_FORCE } from './cookie-choice.js';
import { LEGAL_STANDING } from './legal-standing.js';

describe('the terms of an answer to the cookie banner (task 223)', () => {
  it('answers the cookie policy at the version its standing names', () => {
    expect(COOKIE_POLICY_VERSION_IN_FORCE).toBe(LEGAL_STANDING.cookies.version);
  });

  // The owner's figure, pinned: a change to it is a change to the privacy notice's retention too.
  it('is kept twelve months', () => {
    expect(COOKIE_CHOICE_KEPT_MONTHS).toBe(12);
  });
});

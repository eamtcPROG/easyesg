import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from './api-outcome';
import { endsSession, outcomeEndsSession } from './session-standing';

/**
 * The one number that says a session has ended to the pass-through and the probe (task 92), and the
 * question the api client asks of every answer to a request carrying the bearer (tasks 160, 161). Literals
 * on purpose: these are the wire values.
 */
const problem = (input: { readonly slug: string; readonly status: number }) => ({
  status: API_OUTCOME.Problem,
  problem: { type: `https://easyesg.md/problems/${input.slug}`, status: input.status, title: 'x' },
});

describe('outcomeEndsSession (tasks 160, 161)', () => {
  it.each(['authentication-required', 'session-expired'])('is a problem typed %s', (slug) => {
    expect(outcomeEndsSession(problem({ slug, status: 401 }))).toBe(true);
  });

  // **The reason it reads the type** (task 161): writes reach it now, and a wrong password is a 401 too.
  it('is not a wrong password, though that is answered 401 as well', () => {
    expect(outcomeEndsSession(problem({ slug: 'credential-invalid', status: 401 }))).toBe(false);
  });

  it.each([
    ['insufficient-role', 403],
    ['membership-required', 403],
    ['account-setup-required', 403],
    ['not-found', 404],
    ['internal', 500],
  ])('is not a problem typed %s', (slug, status) => {
    expect(outcomeEndsSession(problem({ slug, status }))).toBe(false);
  });

  it('is not an api that could not be reached, nor an answer that went through', () => {
    expect(outcomeEndsSession({ status: API_OUTCOME.Unreachable })).toBe(false);
    expect(outcomeEndsSession({ status: API_OUTCOME.Ok, value: null, messages: [] })).toBe(false);
  });
});

describe('endsSession (task 92)', () => {
  it('is the status the pass-through and the probe answer', () => {
    expect(endsSession(401)).toBe(true);
    expect(endsSession(403)).toBe(false);
    expect(endsSession(undefined)).toBe(false);
  });
});

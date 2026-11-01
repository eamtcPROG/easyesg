import { describe, expect, it } from 'vitest';
import { readCredentialsOutcome } from './credentials-read';

/** A-19's read arms (task 151), with the wire values asserted as literals. */
describe('readCredentialsOutcome', () => {
  it('answers the standing when the read succeeds', () => {
    const credentials = { recoveryCodesIssuedAt: 1_789_000_000_000, recoveryCodesRemaining: 7 };
    expect(readCredentialsOutcome({ status: 'ok', value: credentials, messages: [] })).toEqual({
      kind: 'ready',
      credentials,
    });
  });

  it('reads a 401 as a session that ended, and an unanswered read as unavailable', () => {
    expect(
      readCredentialsOutcome({
        status: 'problem',
        problem: { type: 'https://easyesg.md/problems/authentication-required', status: 401 },
      }),
    ).toEqual({ kind: 'signed_out' });
    expect(readCredentialsOutcome({ status: 'unreachable' })).toEqual({ kind: 'unavailable' });
  });
});

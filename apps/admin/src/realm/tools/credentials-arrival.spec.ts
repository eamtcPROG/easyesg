import { describe, expect, it } from 'vitest';
import { readCredentialsArrival } from './credentials-arrival';

/**
 * The search param is typed by whoever wrote the link, so this is the one place its word is judged.
 * The wire value is asserted as the literal: a renamed value must break A-01's hand-off here.
 */
describe('readCredentialsArrival (A-19, task 151)', () => {
  it('reads the recovery sign-in’s word', () => {
    expect(readCredentialsArrival('recovered')).toBe('recovered');
  });

  it('drops anything else, a lookalike or a non-string included', () => {
    expect(readCredentialsArrival('invitation-accepted')).toBeUndefined();
    expect(readCredentialsArrival('RECOVERED')).toBeUndefined();
    expect(readCredentialsArrival(9)).toBeUndefined();
    expect(readCredentialsArrival(undefined)).toBeUndefined();
  });
});

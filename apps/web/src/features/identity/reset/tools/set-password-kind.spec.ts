import { describe, expect, it } from 'vitest';
import { SET_PASSWORD_KIND, setPasswordKindOf } from './set-password-kind';

/**
 * The wire value `setup` is asserted as a literal on purpose: the worker writes the same string into
 * the link (`password-reset-email.handler.spec.ts` pins its side), and a rename on either side must fail
 * one of the two specs rather than silently reword S-02.
 */
describe('setPasswordKindOf (task 155)', () => {
  it('words the step as a first password when the link carries intent=setup', () => {
    expect(setPasswordKindOf('setup')).toBe(SET_PASSWORD_KIND.FIRST);
  });

  it('reads every other link as a reset, a link sent before the parameter existed included', () => {
    expect(setPasswordKindOf(undefined)).toBe(SET_PASSWORD_KIND.RESET);
    expect(setPasswordKindOf('')).toBe(SET_PASSWORD_KIND.RESET);
    expect(setPasswordKindOf('SETUP')).toBe(SET_PASSWORD_KIND.RESET);
  });
});

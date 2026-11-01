import { describe, expect, it } from 'vitest';
import { completeAccountRoute, signInRoute } from './routes';

/**
 * The two builders an ended session passes through (task 161): sign-in keeping the address asked for,
 * and S-36 keeping the way on — never S-36 inside itself. Literals on purpose: these are addresses.
 */
describe('signInRoute', () => {
  it('keeps the address to come back to, encoded', () => {
    expect(signInRoute('/reports?page=2')).toBe('/sign-in?return=%2Freports%3Fpage%3D2');
  });

  it('is plain sign-in without one', () => {
    expect(signInRoute(null)).toBe('/sign-in');
  });
});

describe('completeAccountRoute', () => {
  it('carries the way on once setup is done', () => {
    expect(completeAccountRoute('/invitation/t')).toBe('/complete-account?return=%2Finvitation%2Ft');
    expect(completeAccountRoute(null)).toBe('/complete-account');
  });

  it('answers an address that is already S-36 as it is, so no return is buried inside another', () => {
    expect(completeAccountRoute('/complete-account?return=%2Finvitation%2Ft')).toBe(
      '/complete-account?return=%2Finvitation%2Ft',
    );
    expect(completeAccountRoute('/complete-account')).toBe('/complete-account');
  });

  it('wraps an address that only begins with the same letters', () => {
    expect(completeAccountRoute('/complete-accounts')).toBe(
      '/complete-account?return=%2Fcomplete-accounts',
    );
  });
});

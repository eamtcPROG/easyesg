import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  sessionExpiresAt,
  sessionHasExpired,
} from './session-expiry';

/**
 * §12.5.6's two clocks (OQ-35, closed 21 Aug 2026), pinned as arithmetic. The values themselves
 * are asserted too: they are register content, and a "tidy" of the constants would otherwise be
 * a silent policy change.
 */
describe('session expiry (OQ-35)', () => {
  const signedInAt = new Date('2026-08-21T10:00:00Z');

  it('carries the register values: 7 days idle, 30 days absolute', () => {
    expect(SESSION_IDLE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SESSION_ABSOLUTE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('expires by the idle clock while the absolute cap is far away', () => {
    expect(sessionExpiresAt({ sessionCreatedAt: signedInAt, tokenIssuedAt: signedInAt }).getTime()).toBe(
      signedInAt.getTime() + SESSION_IDLE_TTL_MS,
    );
  });

  it('rotation rolls the idle window from the current token, not from sign-in', () => {
    const rotatedAt = new Date(signedInAt.getTime() + 10 * 24 * 60 * 60 * 1000);
    expect(sessionExpiresAt({ sessionCreatedAt: signedInAt, tokenIssuedAt: rotatedAt }).getTime()).toBe(
      rotatedAt.getTime() + SESSION_IDLE_TTL_MS,
    );
  });

  it('the absolute cap wins in the last window — rotation cannot roll past it', () => {
    const rotatedAt = new Date(signedInAt.getTime() + SESSION_ABSOLUTE_TTL_MS - 60_000);
    expect(sessionExpiresAt({ sessionCreatedAt: signedInAt, tokenIssuedAt: rotatedAt }).getTime()).toBe(
      signedInAt.getTime() + SESSION_ABSOLUTE_TTL_MS,
    );
  });

  it('is expired AT the bound, not only past it', () => {
    const bound = sessionExpiresAt({ sessionCreatedAt: signedInAt, tokenIssuedAt: signedInAt });
    expect(sessionHasExpired({ sessionCreatedAt: signedInAt, tokenIssuedAt: signedInAt }, new Date(bound.getTime() - 1))).toBe(false);
    expect(sessionHasExpired({ sessionCreatedAt: signedInAt, tokenIssuedAt: signedInAt }, bound)).toBe(true);
  });
});

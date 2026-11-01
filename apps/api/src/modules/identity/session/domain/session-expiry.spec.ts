import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_SHORT_ABSOLUTE_TTL_MS,
  SESSION_SHORT_IDLE_TTL_MS,
  sessionExpiresAt,
  sessionHasExpired,
} from './session-expiry';

/**
 * §12.5.6's clocks (OQ-35, closed 21 Aug 2026 and amended 4 Sep 2026), pinned as arithmetic. The
 * values themselves are asserted too: they are register content, and a "tidy" of the constants
 * would otherwise be a silent policy change.
 */
describe('session expiry (OQ-35)', () => {
  const signedInAt = new Date('2026-08-21T10:00:00Z');
  const remembered = (tokenIssuedAt: Date) => ({
    sessionCreatedAt: signedInAt,
    tokenIssuedAt,
    remembered: true,
  });
  const notRemembered = (tokenIssuedAt: Date) => ({
    sessionCreatedAt: signedInAt,
    tokenIssuedAt,
    remembered: false,
  });

  it('carries the register values: 7 days idle, 30 days absolute when remembered', () => {
    expect(SESSION_IDLE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(SESSION_ABSOLUTE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('carries the shorter pair: 12 h idle and 12 h absolute when not remembered', () => {
    expect(SESSION_SHORT_IDLE_TTL_MS).toBe(12 * 60 * 60 * 1000);
    expect(SESSION_SHORT_ABSOLUTE_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });

  describe('remembered — OQ-35 as originally closed', () => {
    it('expires by the idle clock while the absolute cap is far away', () => {
      expect(sessionExpiresAt(remembered(signedInAt)).getTime()).toBe(
        signedInAt.getTime() + SESSION_IDLE_TTL_MS,
      );
    });

    it('rotation rolls the idle window from the current token, not from sign-in', () => {
      const rotatedAt = new Date(signedInAt.getTime() + 10 * 24 * 60 * 60 * 1000);
      expect(sessionExpiresAt(remembered(rotatedAt)).getTime()).toBe(
        rotatedAt.getTime() + SESSION_IDLE_TTL_MS,
      );
    });

    it('the absolute cap wins in the last window — rotation cannot roll past it', () => {
      const rotatedAt = new Date(signedInAt.getTime() + SESSION_ABSOLUTE_TTL_MS - 60_000);
      expect(sessionExpiresAt(remembered(rotatedAt)).getTime()).toBe(
        signedInAt.getTime() + SESSION_ABSOLUTE_TTL_MS,
      );
    });

    it('is expired AT the bound, not only past it', () => {
      const bound = sessionExpiresAt(remembered(signedInAt));
      expect(sessionHasExpired(remembered(signedInAt), new Date(bound.getTime() - 1))).toBe(false);
      expect(sessionHasExpired(remembered(signedInAt), bound)).toBe(true);
    });
  });

  describe('not remembered — the amendment of 4 Sep 2026', () => {
    it('bounds a fresh session at 12 h rather than 7 days', () => {
      expect(sessionExpiresAt(notRemembered(signedInAt)).getTime()).toBe(
        signedInAt.getTime() + SESSION_SHORT_ABSOLUTE_TTL_MS,
      );
    });

    /**
     * **The property the whole amendment rests on**, and the one a `Math.min` over two equal
     * numbers makes easy to break by accident: declining *keep me signed in* must not produce a
     * session that rolls forward indefinitely through use. Rotate at 11 h — well inside the idle
     * window — and the answer must still be 12 h from SIGN-IN, not 23.
     */
    it('rotation cannot roll it: the absolute cap binds from sign-in', () => {
      const rotatedAt = new Date(signedInAt.getTime() + 11 * 60 * 60 * 1000);
      expect(sessionExpiresAt(notRemembered(rotatedAt)).getTime()).toBe(
        signedInAt.getTime() + SESSION_SHORT_ABSOLUTE_TTL_MS,
      );
    });

    /** The two pairs must actually differ, or every assertion above passes against one policy. */
    it('is shorter than the remembered pair for the same anchors', () => {
      expect(sessionExpiresAt(notRemembered(signedInAt)).getTime()).toBeLessThan(
        sessionExpiresAt(remembered(signedInAt)).getTime(),
      );
    });

    it('is still live just before its bound and expired at it', () => {
      const bound = sessionExpiresAt(notRemembered(signedInAt));
      expect(sessionHasExpired(notRemembered(signedInAt), new Date(bound.getTime() - 1))).toBe(
        false,
      );
      expect(sessionHasExpired(notRemembered(signedInAt), bound)).toBe(true);
    });

    /**
     * A session a remembered policy would still honour must be dead here — the assertion that
     * fails if `sessionExpiresAt` ever ignores the flag and reads one pair for both.
     */
    it('a 13 h-old session is expired where a remembered one would have six days left', () => {
      const thirteenHoursOn = new Date(signedInAt.getTime() + 13 * 60 * 60 * 1000);
      expect(sessionHasExpired(notRemembered(signedInAt), thirteenHoursOn)).toBe(true);
      expect(sessionHasExpired(remembered(signedInAt), thirteenHoursOn)).toBe(false);
    });
  });
});

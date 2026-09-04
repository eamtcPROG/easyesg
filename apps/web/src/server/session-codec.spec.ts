import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { sealJson, sealSession, unsealSession, type SessionPayload } from './session-codec';

const SECRET = 'spec-secret-0000000000000000000000000000';

const payload: SessionPayload = {
  accessToken: 'jwt.access.token',
  accessTokenExpiresAt: 1_787_444_100_000,
  refreshToken: 'opaque-refresh-token',
  refreshTokenExpiresAt: 1_788_048_000_000,
  remembered: true,
  account: { id: 'c0ffee00-0000-7000-8000-000000000001', email: 'ana@example.md', locale: 'ro' },
};

describe('the session cookie codec (OQ-33)', () => {
  it('round-trips a payload under the same secret', () => {
    expect(unsealSession(sealSession(payload, SECRET), SECRET)).toEqual(payload);
  });

  it('seals non-deterministically — two cookies for one session never match', () => {
    // A fresh GCM nonce per seal; equal cookie values would let an observer correlate.
    expect(sealSession(payload, SECRET)).not.toEqual(sealSession(payload, SECRET));
  });

  it('answers null for a tampered cookie — the auth tag fails before any parser runs', () => {
    const sealed = sealSession(payload, SECRET);
    // Swap the first character for a different valid base64url character — a changed IV byte
    // is enough for GCM's tag to refuse the whole payload.
    const a = 'A'.charCodeAt(0);
    const flipped =
      String.fromCharCode(sealed.charCodeAt(0) === a ? a + 1 : a) + sealed.slice(1);
    expect(unsealSession(flipped, SECRET)).toBeNull();
    expect(unsealSession(sealed.slice(0, -2), SECRET)).toBeNull();
  });

  it('answers null under a rotated secret — a deploy-time rotation reads as signed out', () => {
    expect(unsealSession(sealSession(payload, SECRET), 'a-different-secret')).toBeNull();
  });

  it('answers null for garbage and for the empty string, without throwing', () => {
    expect(unsealSession('not-base64url-at-all!!!', SECRET)).toBeNull();
    expect(unsealSession('', SECRET)).toBeNull();
  });

  it('answers null for a validly sealed payload of the wrong shape — validated, never cast', () => {
    // A stale cookie format after a payload change must read as "no session", not crash on a
    // missing member three files later.
    const stale = { accessToken: 'only-this' } as unknown as SessionPayload;
    expect(unsealSession(sealSession(stale, SECRET), SECRET)).toBeNull();
  });

  it('answers null for a payload whose locale is outside the registry', () => {
    const foreign = { ...payload, account: { ...payload.account, locale: 'de' } };
    expect(
      unsealSession(sealSession(foreign as unknown as SessionPayload, SECRET), SECRET),
    ).toBeNull();
  });
});


/**
 * `remembered`'s two rules, neither of which any other check observes (task 97's gate review).
 *
 * They pull in opposite directions on purpose and each is one line of code, so each is one
 * mutation away from being silently wrong: the reader tolerates a payload with no such field and
 * calls it *remembered*, while the wire's default for a client that omits it is *false*.
 */
describe('session persistence in the sealed payload (OQ-35)', () => {
  it('opens a payload sealed before the field existed as remembered', () => {
    // Sealed through the generic box rather than `sealSession`, which is the honest simulation:
    // an older build sealed a payload with no such key, and the typed sealer cannot express that
    // shape today — which is the point.
    const { remembered: _dropped, ...legacy } = payload;
    const sealed = sealJson(legacy, SECRET);

    // `true`, not `false`: the session was granted under the original 7 d / 30 d policy, so reading
    // it short would retroactively shorten a window already given — the same view the migration's
    // backfill takes of a session row.
    expect(unsealSession(sealed, SECRET)?.remembered).toBe(true);
  });

  it('keeps a declined session declined across the seal', () => {
    const declined = sealSession({ ...payload, remembered: false }, SECRET);
    expect(unsealSession(declined, SECRET)?.remembered).toBe(false);
  });
});

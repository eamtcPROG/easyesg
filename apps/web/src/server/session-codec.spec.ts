import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { sealSession, unsealSession, type SessionPayload } from './session-codec';

const SECRET = 'spec-secret-0000000000000000000000000000';

const payload: SessionPayload = {
  accessToken: 'jwt.access.token',
  accessTokenExpiresAt: 1_787_444_100_000,
  refreshToken: 'opaque-refresh-token',
  refreshTokenExpiresAt: 1_788_048_000_000,
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

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

// `sessionCookie` seals the payload, so it reaches `env.sessionSecret` — a getter that throws when
// the variable is absent (`lib/env.ts`), which is the right behaviour and not this spec's subject.
// Set before the import below, because the module graph reads it on first call.
process.env.SESSION_SECRET ??= 'spec-secret-0000000000000000000000000000';

import { sessionCookie } from './session';
import type { SessionPayload } from './session-codec';

/**
 * `sessionCookie` is a pure function from a payload to a set of attributes, and **the one attribute
 * this task added had no hermetic check at all** (task 97's gate review): only `pnpm e2e:web` — the
 * built bundles, Docker, six minutes — could see a declined session written with a `Max-Age`.
 *
 * The unit is the cheapest possible one, so this is where the rule belongs; the browser test stays
 * for the half a unit cannot reach, which is that a real browser then treats it as a session cookie.
 */
const payload = (remembered: boolean): SessionPayload => ({
  accessToken: 'jwt.access.token',
  accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
  refreshToken: 'opaque-refresh-token',
  refreshTokenExpiresAt: Date.now() + 12 * 60 * 60 * 1000,
  remembered,
  account: { id: 'c0ffee00-0000-7000-8000-000000000001', email: 'ana@example.md', locale: 'ro' },
});

describe('the session cookie’s persistence (OQ-35, §12.5.6)', () => {
  it('carries no Max-Age at all when the session was not remembered', () => {
    // **`undefined`, and the distinction from `0` is the whole point**: zero is a valid `Max-Age`
    // meaning *expire immediately*, which deletes the cookie rather than making it session-scoped.
    // `toBeUndefined` is what tells those two apart; `toBeFalsy` would accept the defect.
    expect(sessionCookie(payload(false)).maxAge).toBeUndefined();
  });

  it('carries one, bounded by the stated refresh expiry, when it was', () => {
    const maxAge = sessionCookie(payload(true)).maxAge;

    expect(maxAge).toBeGreaterThan(0);
    // Bounded by what the API said, never by the policy restated here — a second copy of a window
    // is a second thing to get wrong.
    expect(maxAge).toBeLessThanOrEqual(12 * 60 * 60);
  });

  it('keeps OQ-33’s other attributes whichever way the choice went', () => {
    for (const remembered of [true, false]) {
      expect(sessionCookie(payload(remembered))).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    }
  });
});

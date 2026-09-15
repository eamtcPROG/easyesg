import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The sealed setup grant (task 155), against a stubbed cookie store and the real codec.
 *
 * What only this can pin: that the grant never rides the cookie in the clear, that the cookie lives
 * exactly as long as the API said the grant does, that a read spends nothing and a consume clears, and
 * that putting back what was taken cannot stretch the window — the property the action's put-back rests
 * on, since a refused attempt holds the same value again.
 */
vi.mock('server-only', () => ({}));

const jar = new Map<string, { value: string; maxAge?: number }>();

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const held = jar.get(name);
        return held ? { name, value: held.value } : undefined;
      },
      set: (name: string, value: string, options: { maxAge?: number }) => {
        jar.set(name, { value, maxAge: options.maxAge });
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    }),
}));

import { sealJson } from '../session/session-codec';
import {
  consumeSetupGrant,
  holdSetupGrant,
  peekSetupGrant,
  type HeldSetupGrant,
} from './setup-grant';

const SECRET = 'spec-secret-0000000000000000000000000000';
const COOKIE = 'easyesg_setup_grant';

describe('the sealed setup grant (task 155)', () => {
  const now = Date.parse('2026-09-14T10:00:00Z');
  const held: HeldSetupGrant = {
    grant: 'g'.repeat(43),
    email: 'ion.rusu@example.md',
    expiresAt: now + 10 * 60 * 1000,
    returnTo: '/invitation/token-1',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv('SESSION_SECRET', SECRET);
    jar.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('holds it sealed, for exactly as long as the API said the grant lives', async () => {
    await holdSetupGrant(held);

    expect(jar.get(COOKIE)?.value).not.toContain(held.grant);
    expect(jar.get(COOKIE)?.maxAge).toBe(600);
    expect(await peekSetupGrant()).toEqual(held);
  });

  it('spends nothing on a read, and clears on a consume', async () => {
    await holdSetupGrant(held);

    await peekSetupGrant();
    expect(jar.has(COOKIE)).toBe(true);

    expect(await consumeSetupGrant()).toEqual(held);
    expect(jar.has(COOKIE)).toBe(false);
    expect(await consumeSetupGrant()).toBeNull();
  });

  it('reads a grant at its expiry as none, whatever the browser still presents', async () => {
    await holdSetupGrant(held);
    vi.setSystemTime(held.expiresAt);

    expect(await peekSetupGrant()).toBeNull();
  });

  it('puts back exactly what was taken, so a retry cannot stretch the window', async () => {
    await holdSetupGrant(held);
    const taken = await consumeSetupGrant();
    if (taken === null) throw new Error('the grant was not held');

    vi.setSystemTime(now + 5 * 60 * 1000);
    await holdSetupGrant(taken);

    expect((await peekSetupGrant())?.expiresAt).toBe(held.expiresAt);
    expect(jar.get(COOKIE)?.maxAge).toBe(300);
  });

  it('reads a foreign shape as no grant — validated, never cast', async () => {
    jar.set(COOKIE, { value: sealJson({ grant: 'g'.repeat(43), expiresAt: now + 60_000 }, SECRET) });

    expect(await peekSetupGrant()).toBeNull();
  });
});

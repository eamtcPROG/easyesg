import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  admitAuthAttempt,
  factorChallengeThrottleKey,
  reauthenticationThrottleKey,
  signInThrottleKey,
  totpConfirmationThrottleKey,
  type AuthAttemptRecorder,
} from './auth-throttle';

/**
 * §12.5.6's sliding window, as one operation (added 27 Aug 2026 with `admitAuthAttempt`).
 *
 * **This file exists because the module had no spec and four callers had the rule backwards.** The
 * `count`-then-`record`-then-compare shape was copied into the factor step, both re-authentication
 * paths and the password change, and every copy recorded the attempt *before* deciding — which
 * inverts the module's own stated rule and was invisible to every test, because each copy was
 * internally consistent and each throttled *something*. Only a test that watches what happens on
 * the refusing call can tell the two apart.
 */
class RecordingStore implements AuthAttemptRecorder {
  readonly attempts: { key: string; at: Date }[] = [];

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.attempts.filter((a) => a.key === key && a.at.getTime() >= since.getTime()).length,
    );
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    this.attempts.push({ key, at });
    return Promise.resolve();
  }
}

const KEY = 'sign-in:198.51.100.7:ana.popescu@example.md';

describe('admitAuthAttempt — §12.5.6 sliding window', () => {
  const now = new Date('2026-08-27T10:00:00Z');
  let store: RecordingStore;

  beforeEach(() => {
    store = new RecordingStore();
  });

  const spend = (at: Date = now) => admitAuthAttempt(store, { key: KEY, now: at });

  it('admits up to the limit and records each one', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT; attempt += 1) {
      await expect(spend()).resolves.toBe(true);
    }
    expect(store.attempts).toHaveLength(AUTH_ATTEMPT_LIMIT);
  });

  it('refuses past the limit', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT; attempt += 1) await spend();
    await expect(spend()).resolves.toBe(false);
  });

  /**
   * **The property four copies got wrong**, and the only one whose absence is invisible: a refused
   * attempt still throttles, so a test asserting "the sixth is refused" passes either way.
   *
   * Recording it re-arms the window on every request, so a hammering client keeps its own block
   * alive forever — and the person hammering is usually the account's owner, retrying because they
   * mistyped. Under the wrong version they are refused for as long as they keep trying rather than
   * for fifteen minutes.
   */
  it('does NOT record a refused attempt, so a block drains instead of rolling forever', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT; attempt += 1) await spend();

    await spend();
    await spend();
    await spend();

    expect(store.attempts).toHaveLength(AUTH_ATTEMPT_LIMIT);
  });

  it('drains once the oldest attempts fall out of the window', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT; attempt += 1) await spend();
    await expect(spend()).resolves.toBe(false);

    // One millisecond past the window's edge, measured from the first attempt.
    const later = new Date(now.getTime() + AUTH_ATTEMPT_WINDOW_MS + 1);
    await expect(spend(later)).resolves.toBe(true);
  });

  it('counts per key, so one path cannot exhaust another', async () => {
    for (let attempt = 0; attempt < AUTH_ATTEMPT_LIMIT; attempt += 1) await spend();

    await expect(
      admitAuthAttempt(store, { key: 'password-reset:198.51.100.7:ana.popescu@example.md', now }),
    ).resolves.toBe(true);
  });
});

/**
 * The keys themselves. Each path has its own segment on purpose — the two steps of one sign-in, and
 * a settings screen versus the sign-in page, must not exhaust each other's budget — and the
 * assertions are written against the **literal** wire strings rather than by calling the builders,
 * because a key that silently changes shape silently resets every live window.
 */
describe('the throttle keys are distinct per path (§12.5.6)', () => {
  const ip = '198.51.100.7';

  it('keys sign-in on the address and the factor step on the account', () => {
    expect(signInThrottleKey(ip, 'Ana.Popescu@example.md')).toBe(
      'sign-in:198.51.100.7:ana.popescu@example.md',
    );
    expect(factorChallengeThrottleKey(ip, 'account-1')).toBe(
      'factor-challenge:198.51.100.7:account-1',
    );
  });

  it('gives the enrolment confirmation its own segment, apart from re-authentication', () => {
    // Task 27.5 threw a window at the three password-gated TOTP routes and passed over the one that
    // verifies a code and mints ten recovery codes. Its own segment, so a fumbled enrolment does
    // not spend the budget the password change needs.
    expect(totpConfirmationThrottleKey(ip, 'account-1')).toBe(
      'totp-confirmation:198.51.100.7:account-1',
    );
    expect(reauthenticationThrottleKey(ip, 'account-1')).toBe(
      'reauthentication:198.51.100.7:account-1',
    );
  });

  it('degrades to one bucket per subject when no client IP has been resolved', () => {
    // Task 71 configures the edge; until then this is a narrower net, never no net.
    expect(reauthenticationThrottleKey(undefined, 'account-1')).toBe(
      'reauthentication:unknown:account-1',
    );
  });
});

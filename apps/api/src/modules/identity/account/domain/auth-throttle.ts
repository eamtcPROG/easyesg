/**
 * The application-level abuse controls on the auth paths (FR-4, NFR-64; values from §12.5.6,
 * OQ-19 / non_functional_requirements.md OQ-4, closed 18 Aug 2026).
 *
 * Lives in `account/domain` rather than in the session module because both consumers can then
 * depend one way: sign-in (session module) already imports account models, and the reset request
 * (this module) is the other throttled path — §12.5.6 names login, reset request and invitation
 * accept, and the invitation module will import from here at task 26.
 *
 * Two distinct controls, often conflated:
 *
 *  - **The rate limit — 5 attempts / 15 min per (IP, account)** — is a sliding window over
 *    PROCESSED attempts, keyed per path. It cannot live at `edge`: Caddy's budgets (§12.5.6) are
 *    per IP and per organization, and the per-account half requires reading the request body.
 *    Refused attempts are not recorded, so a block always drains 15 minutes after the fifth
 *    processed attempt instead of rolling forever under a hammering client.
 *  - **The lockout — 10 consecutive failures** — is a durable state on the credential, counted
 *    across windows and IPs, released only by a consumed reset link (this task) or PA action
 *    (task 67). The rate limit slows guessing; the lockout ends it.
 *
 * The window count is read-then-insert without a lock, so two concurrent attempts can both pass
 * at four — the limit is approximate under concurrency, deliberately: it is a throttle, and the
 * lockout behind it is exact (its increment is a single atomic UPDATE).
 */

export const AUTH_ATTEMPT_LIMIT = 5;

export const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/** FR-4's "threshold". */
export const LOCKOUT_THRESHOLD = 10;

const throttleKey = (path: string, clientIp: string | undefined, email: string): string =>
  // The email is lower-cased so the key agrees with `account_email_key`'s idea of identity, and
  // a missing IP (no trust-proxy resolution yet — task 71 configures the edge) degrades to one
  // shared bucket rather than to no throttle at all.
  `${path}:${clientIp ?? 'unknown'}:${email.toLowerCase()}`;

export const signInThrottleKey = (clientIp: string | undefined, email: string): string =>
  throttleKey('sign-in', clientIp, email);

export const passwordResetThrottleKey = (clientIp: string | undefined, email: string): string =>
  throttleKey('password-reset', clientIp, email);

/** The admin realm's sign-in (FR-75, task 23) — its own path segment, so an address probed on
 *  both surfaces spends two budgets and neither leaks into the other's window. */
export const adminSignInThrottleKey = (clientIp: string | undefined, email: string): string =>
  throttleKey('admin-sign-in', clientIp, email);

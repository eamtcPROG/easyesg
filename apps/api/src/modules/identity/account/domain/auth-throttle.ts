/**
 * The application-level abuse controls on the auth paths (FR-4, NFR-64; values from §12.5.6,
 * OQ-19 / non_functional_requirements.md OQ-4, closed 18 Aug 2026).
 *
 * Lives in `account/domain` rather than in the session module because both consumers can then
 * depend one way: sign-in (session module) already imports account models, and the reset request
 * (this module) is the other throttled path — §12.5.6 names login, reset request and invitation
 * accept. **The invitation module imports from here since task 26.2**, which is the third of the
 * three the table names and the one this comment was written in anticipation of.
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

/**
 * The social completion path (task 24). §12.5.6's per-(IP, account) key cannot be built here —
 * the account is unknowable before the code exchange the throttle guards — so the key degrades
 * to per (IP, provider), the same recorded degradation as task 21's missing `clientIp`: a
 * narrower net than specified, never no net. The credential itself is guessed at the provider,
 * not here; this bounds how fast one address can spend our token-endpoint round trips.
 */
export const socialSignInThrottleKey = (clientIp: string | undefined, provider: string): string =>
  throttleKey('social-sign-in', clientIp, provider);

/**
 * UC-15's acceptance — the third path §12.5.6's auth row names, in terms (task 26.2).
 *
 * **The per-(IP, account) key is buildable here, unlike on the social path.** The route requires a
 * session, so the account is known before the token is looked at, and this is the specified key
 * rather than a degradation of it.
 *
 * What it bounds is token guessing against a known actor. The token is 256 bits, so guessing is
 * hopeless on the arithmetic alone — this is the belt to that: it costs one row per attempt and it
 * is what the requirement says, and it keeps the property true if the token is ever shortened or a
 * lookup is ever rewritten to compare in application code.
 */
export const invitationAcceptThrottleKey = (
  clientIp: string | undefined,
  accountId: string,
): string => throttleKey('invitation-accept', clientIp, accountId);

/**
 * S-03's preview (task 26.2), which §12.5.6 does **not** name — it is this task's own route.
 *
 * It is throttled anyway, and the reason is the shape rather than the register: it is the one
 * **unauthenticated** surface in the system that answers a question about a token, so it is where a
 * token would be probed if anyone tried. The account half of the key is unbuildable — there is no
 * session, and serving someone who has no account is the route's entire purpose — so it degrades to
 * per IP, the same recorded degradation the social path carries and for the same reason: a narrower
 * net than the table specifies, never no net.
 *
 * The third segment is a constant rather than the token itself. Keying by token would give every
 * guess its own fresh budget, which is the opposite of a throttle.
 */
export const invitationPreviewThrottleKey = (clientIp: string | undefined): string =>
  throttleKey('invitation-preview', clientIp, 'anonymous');

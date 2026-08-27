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

/**
 * The two operations a throttled path needs from whatever store it runs in.
 *
 * Structural and declared here rather than imported from one module's transaction, so
 * `identity/session`, `identity/account` and `identity/provider` each satisfy it with the
 * transaction they already have — ISP, and the alternative is a shared base type three modules
 * would have to agree on to spend a window.
 */
export interface AuthAttemptRecorder {
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;
  recordAuthAttempt(key: string, at: Date): Promise<void>;
}

/**
 * **Spend one attempt against `key`, or refuse — the sliding window's one implementation**
 * (added 27 Aug 2026).
 *
 * The `count`-then-`record`-then-compare shape had been written **four** times — the factor step,
 * `ManageTotp.reauthenticate`, `ChangePassword` and `ManageProviderLinks.reauthenticate` — and all
 * four recorded the attempt *before* deciding, which inverts the rule stated above: **a refused
 * attempt must not be recorded.** Recording it means every hammering request re-arms the window, so
 * the block never drains; a user who mistypes five times and then keeps trying — which is what a
 * person does — stays refused indefinitely rather than for fifteen minutes.
 *
 * `SignIn` had it right and was the only one, which is the whole lesson: this is an operation over
 * the vocabulary this module owns, and CLAUDE.md's rule puts it here rather than at each caller.
 * Four locally-plausible copies is precisely the shape under which no test can see the difference,
 * because each copy is self-consistent.
 *
 * Answers **true when the attempt is admitted**, and is named for that rather than for the check —
 * it writes a row, so it is not a predicate.
 */
export async function admitAuthAttempt(
  tx: AuthAttemptRecorder,
  attempt: { readonly key: string; readonly now: Date },
): Promise<boolean> {
  const since = new Date(attempt.now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
  if ((await tx.countRecentAuthAttempts(attempt.key, since)) >= AUTH_ATTEMPT_LIMIT) return false;
  await tx.recordAuthAttempt(attempt.key, attempt.now);
  return true;
}

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
 * The tenant second-factor step (UC-194, task 27.3).
 *
 * **Its own path segment, keyed on the ACCOUNT rather than the address**, and both halves are
 * deliberate. Its own segment for `adminSignInThrottleKey`'s reason — the two steps of one sign-in
 * should not exhaust each other's budget, since a user who mistypes a code has not been probing
 * passwords. Keyed on the account because at this point the account is *known*: it came out of a
 * sealed challenge this API issued, which is the same reason `invitationAcceptThrottleKey` gets
 * §12.5.6's specified key where the social path could only degrade to one.
 */
export const factorChallengeThrottleKey = (
  clientIp: string | undefined,
  accountId: string,
): string => throttleKey('factor-challenge', clientIp, accountId);

/**
 * **Re-authentication** — every route that asks for the current password *behind an existing
 * session* (§12.5.6's task-27.5 row): FR-7's password change, and task 27.2's three
 * password-gated TOTP routes, which shipped without one.
 *
 * **Such a route is a password oracle reachable with only a stolen session.** The edge's
 * authenticated budget is 300 req/min per organization, so an unbounded route yields eighteen
 * thousand guesses an hour against a value people reuse across services — and the attacker already
 * holds the session, so nothing else stops them.
 *
 * **Its own path segment**, for `adminSignInThrottleKey`'s reason: someone fumbling their password
 * on a settings screen has not been probing the sign-in page, and neither budget should exhaust the
 * other. **Keyed on the account** rather than the address, which is buildable here for
 * `invitationAcceptThrottleKey`'s reason — the route requires a session, so the account is known
 * before the password is looked at, and this is §12.5.6's specified key rather than a degradation.
 *
 * What it deliberately does **not** do is feed FR-4's lockout, unlike sign-in and the factor step.
 * The caller has already proved possession of a session; a mistyped password on a settings screen
 * must not be able to sign them out of every device. Rate without lockout is the whole of it.
 */
export const reauthenticationThrottleKey = (
  clientIp: string | undefined,
  accountId: string,
): string => throttleKey('reauthentication', clientIp, accountId);

/**
 * **Confirming an enrolment** — `POST /account/totp/confirmation` (UC-193; added 27 Aug 2026).
 *
 * This route shipped on 26 Aug 2026 with no window at all, and it is the one that most needed one:
 * it verifies a six-digit code and **issues ten recovery codes** on success. The other three TOTP
 * routes were bounded by `reauthenticationThrottleKey` because they take a password; this one takes
 * a code instead, and taking a code is not a reason to be unbounded — it is the reason to be
 * bounded, since 10^6 is a space an unthrottled caller can walk.
 *
 * The reachable case is narrow and real: `begin` stores the secret **inert**, so an abandoned
 * enrolment is an ordinary state, and a caller on a stolen session who finds one can guess against
 * it at the edge's 300 req/min for as long as they like. A hit activates a factor they did not
 * enrol and hands them a credential set that survives the owner's password change.
 *
 * **Its own segment**, for `adminSignInThrottleKey`'s reason — someone mistyping the code their
 * authenticator is showing has not been probing passwords, and neither budget should exhaust the
 * other. **Keyed on the account**, buildable here because the route requires a session.
 *
 * Like the re-authentication window and unlike sign-in's, it does **not** feed FR-4's lockout: the
 * caller already holds a session, and a fumbled enrolment must not sign them out of every device.
 */
export const totpConfirmationThrottleKey = (
  clientIp: string | undefined,
  accountId: string,
): string => throttleKey('totp-confirmation', clientIp, accountId);

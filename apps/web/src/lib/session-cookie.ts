/**
 * Every cookie the tenant application sets — its name and, where this tier decides it, how long it lasts. Deliberately
 * not in `src/server/` and deliberately carrying no `server-only` marker: `proxy.ts` needs the names and is neither a
 * Server Component nor a client bundle, and the cookie policy's inventory reads all of it (task 75.2,
 * `lib/cookie-inventory.ts`). Names are not secrets; the values never leave the server — but for the cookie banner's
 * answer, which the page's own script reads (task 223).
 *
 * **Declared here rather than beside each writer** since task 75.2 (182/122): the disclosure must be true of what the
 * application sets, and one module holding the facts it states is what lets the inventory import them rather than
 * restate them.
 */

/**
 * The one session cookie (OQ-33, closed 21 Aug 2026 — architecture.md §12.5.6): AD-12's whole
 * session — access token, rotated-on-use refresh token, both expiries, the identity block —
 * sealed AES-256-GCM under `SESSION_SECRET` by `src/server/session-codec.ts`. httpOnly, so no
 * token is ever exposed to browser JavaScript (AD-9); sealed, so none leaves the Node tier in
 * any readable form either.
 */
export const REFRESH_COOKIE = 'easyesg_session';

/**
 * next-intl's locale cookie. The session writes it at sign-in from the user's profile
 * preference (S-27, FR-10), which is how a signed-in user's language reaches the bare-path
 * redirect without the redirect having to know about sessions.
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * The in-flight OAuth transaction (task 24, §12.5.6's task-24 flow row): `state`, `nonce`, the
 * PKCE verifier, the intent and the return path, sealed under `SESSION_SECRET` by
 * `src/server/social-transaction.ts`. Short-lived, path-scoped to `/auth/social`, and
 * `SameSite=Lax` **by necessity, not habit**: the provider's callback arrives as a cross-site
 * top-level GET, which is exactly the navigation `Lax` still sends cookies on and `Strict`
 * does not — under `Strict` every callback would look like a restarted flow.
 */
export const SOCIAL_TRANSACTION_COOKIE = 'easyesg_social';

/**
 * How long next-intl's locale cookie lasts once a profile preference writes it — at sign-in, and when S-36's second
 * step saves the language chosen (`rememberLocale`). next-intl's own middleware writes the same cookie with no
 * `maxAge`, a browser-session cookie, when a locale is chosen by address.
 */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** How long the OAuth transaction lasts — a provider round trip, not a session. */
export const SOCIAL_TRANSACTION_TTL_MS = 10 * 60 * 1000;

/**
 * S-01's factor step (task 27.8): the API's sealed challenge, held between the password step and the code, so the
 * browser never holds the challenge itself. It is **not** single-use, deliberately: a mistyped code must leave the
 * reader on the step rather than send them back to their password, so `completeFactorAction` puts it back on a
 * refusal. What bounds guessing is the API's own throttle and FR-4's lockout, not this cookie.
 */
export const FACTOR_CHALLENGE_COOKIE = 'easyesg_factor_challenge';

/** Five minutes, matching the API's own window — the cookie must not outlive what it holds. */
export const FACTOR_CHALLENGE_TTL_SECONDS = 5 * 60;

/**
 * A provider link waiting for its password confirmation (FR-8, task 27.6) — bound to the account that began it. If
 * the user abandons the screen, the cookie expires and nothing is half-done: no identity was attached, because
 * attaching is what the password buys.
 */
export const PENDING_LINK_COOKIE = 'easyesg_pending_link';

/** Five minutes, matching the transaction's own bound — a person confirming, not a session. */
export const PENDING_LINK_TTL_SECONDS = 5 * 60;

/**
 * S-36's password step reached from S-02's setup link (task 155): the API's grant, sealed until the password is set.
 * **The expiry is the API's**, answered with the grant, never a quarter-hour restated here.
 */
export const SETUP_GRANT_COOKIE = 'easyesg_setup_grant';

/**
 * The answer to the cookie banner (task 223; `architecture.md` §12.5.6's task-223 row (2), (8)): the server record's id,
 * the cookie policy version answered and the moment, written by S-31's codec
 * (`features/public/cookie-choice/tools/cookie-choice-cookie.ts`). **The one cookie here that is neither sealed nor
 * `httpOnly`**: the banner decides after hydration whether to show itself, so that the prerendered home stays
 * prerendered, and the value is no secret — only a pointer to what the browser was told. It lasts
 * `COOKIE_CHOICE_KEPT_MONTHS` from the answer, the months the server keeps the record.
 */
export const COOKIE_CHOICE_COOKIE = 'easyesg_cookie_choice';

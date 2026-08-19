/**
 * The administrative auth realm — session handling for `admin.<host>`.
 *
 * NOT BUILT. This file is a docblock over an empty export, and the shape below is the decision
 * it is holding open, not a plan to be improvised past.
 *
 * NFR-65: the console is separately addressed, network-restricted and MFA-mandatory, and shares
 * no session, cookie scope or credential with the tenant surface. AD-9 rejected an admin route
 * group inside apps/web precisely because that shares an origin and a cookie scope by
 * construction.
 *
 * AD-12 names the trap this file exists to avoid. apps/web keeps its access token server-side
 * because Next.js gives it a rendering tier to keep it in. A static Vite bundle has no such tier,
 * so left unaddressed the *more* privileged surface would be the one holding its token in browser
 * JavaScript — inverting the risk gradient §14.2 says must run the other way.
 *
 * The resolution is architecture.md OQ-17, and it is CLOSED: the token handler is a route on
 * `api` — `POST /auth/admin/session` — not a Caddy module and not a separate service. A handler
 * at the edge would be a second auth surface that no contract test and no OpenAPI diff (P-5)
 * would ever see. Note that AD-12's own prose and §14.2 still describe an `edge` endpoint; that
 * wording predates OQ-17 and is being corrected. OQ-17 governs.
 *
 * Still blocking, and not to be guessed at:
 *   · OQ-33 — cookie attributes and whether state-changing requests carry a CSRF token.
 *     "Needed before the first authenticated write ships", which is A-01 in Phase 2.
 *   · OQ-34 — CSP and the security-header inventory for a static bundle served by `edge`.
 *
 * Session lifetime is the one part already settled: 8 h idle, 12 h absolute (§12.5.6), against a
 * ≤ 15 min access token carrying `session_id` only (AD-12).
 */
export {};

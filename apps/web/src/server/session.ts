import 'server-only';
import { REFRESH_COOKIE } from '@/lib/session-cookie';

/**
 * The session tier — the one file that touches credentials.
 *
 * AD-12: the access token is a short-lived (<= 15 min) signed JWT carrying `session_id` and
 * **nothing else of authorization consequence** — no role, no organization, no entitlement
 * snapshot. Refresh tokens are opaque, stored server-side, rotated on use and revocable.
 *
 * Role, active organization and per-report rights are read server-side on every request from
 * the session and membership records. Carrying `role` in the token was considered and rejected
 * as a live footgun: some guard, at some point, trusts the claim instead of the lookup, and
 * nothing in the design would catch it. The same reasoning is why AD-2 grounds `app.current_org`
 * in the membership lookup rather than a claim.
 *
 * AD-9: the refresh cookie is httpOnly, so no token is exposed to browser JavaScript. The
 * `client-not-to-server` boundary rule and `server-only` are the two mechanisms that keep this
 * module out of a browser bundle — one fails the build, the other fails CI.
 *
 * Not built: the token exchange, rotation, the sign-in flow that also writes the locale cookie
 * from the profile preference, and organization switching.
 *
 * Open: no tenant session idle or absolute lifetime is stated anywhere in the doc set — only
 * the admin surface's 8 h idle / 12 h absolute (§12.5.6). Logged in architecture.md §18.
 */
export const refreshCookieName = REFRESH_COOKIE;
export {};

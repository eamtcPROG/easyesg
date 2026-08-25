/**
 * Client-side pacing for the resend control on S-02 (`architecture.md` OQ-55 added the route;
 * the prototype draws a cooldown countdown beside the button).
 *
 * **Assumption, recorded (task 20):** no source states a cooldown length — the server-side
 * control on these unauthenticated routes is the edge rate limit (§12.5.6, 60 req/min per IP,
 * task 71), and this value is UX pacing only, enforceable by nobody. 60 s was chosen to sit at
 * the same order as that limit. If a real value is ever decided, it lands here and nothing
 * else moves.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Where the register screen leaves the address for the verification-pending screen (S-01 exits
 * to S-02). Session storage, deliberately: the address must survive the client-side navigation
 * but is personal data, so it stays out of the URL (an address in a query string lands in
 * server logs and browser history) and out of any cookie (it has no server-side reader). A
 * visitor arriving at `/verify` without it gets the resend form, which asks for the address.
 */
export const PENDING_EMAIL_STORAGE_KEY = 'easyesg.verification.email';

/** Sibling timestamp (epoch ms) pacing the cooldown across reloads of the pending screen. */
export const RESEND_SENT_AT_STORAGE_KEY = 'easyesg.verification.sentAt';

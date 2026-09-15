/**
 * The link path's lapse (task 155) — S-36's password step reached from S-02, where the confirmation's
 * grant has run out or was never held.
 *
 * **A fourth `status` beside `API_OUTCOME`'s three**, `factor.ts`'s `FACTOR_LAPSED` shape exactly:
 * no server can send it, because nothing failed to reach the API — there was nothing to send it. It
 * is its own standing so the step can say the window closed, and point at the two ways on, rather
 * than inviting a retry that cannot succeed.
 */
export const SETUP_GRANT_LAPSED = 'setup-grant-lapsed';

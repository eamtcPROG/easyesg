/**
 * UX-124's countdown (task 67.9) — whole minutes left before a grant's 60 minutes run out, **rounded up**, so the
 * last minute reads *1 minute left* rather than *0* while the grant still admits a read, and a grant just
 * expired reads 0 and never a negative number.
 *
 * The instants are the api's (`expiresAt`) and the reader's clock; the api is what ends access, at its own
 * instant, so a clock that drifts shows a countdown that is slightly wrong and never a read that is admitted late.
 */
const MINUTE_MS = 60 * 1000;

export const minutesLeft = (input: { readonly expiresAt: number; readonly now: number }): number =>
  Math.max(0, Math.ceil((input.expiresAt - input.now) / MINUTE_MS));

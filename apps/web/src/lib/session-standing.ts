/**
 * Whether this browser still holds a session the api will accept — the one fact S-07's re-authentication
 * turns on (task 92; UX-38, UC-07), learned in two places that must agree.
 *
 * **Both learn it from a status code, and it is the same code.** A write through the pass-through is
 * refused `401` when the sealed cookie is gone or the api has judged the session dead
 * (`authentication-required`, `session-expired`), and `GET /auth/session` answers `401` for the same two
 * facts. So *the session has ended* is one predicate over one number, declared here beside the
 * vocabulary rather than restated by each reader — a reader that compared against `403` by mistake would
 * open a sign-in over a period lock.
 *
 * In `lib/` because both tiers read it: the Route Handler that answers the probe, and the browser's
 * autosave reducer and probe.
 */
export const SESSION_STANDING = {
  /** A session the api accepts, or no evidence otherwise — a network failure is not an ending. */
  HELD: 'held',
  /** The cookie is gone or the api refused it: a write cannot be sent until someone signs in again. */
  ENDED: 'ended',
} as const;

export type SessionStanding = (typeof SESSION_STANDING)[keyof typeof SESSION_STANDING];

/** RFC 9110's *authenticate and try again* — the only status that says the session is gone. */
export const SESSION_ENDED_STATUS = 401;

/** Whether an answer at this status means the session has ended. `undefined` is a status nobody sent. */
export const endsSession = (status: number | undefined): boolean => status === SESSION_ENDED_STATUS;

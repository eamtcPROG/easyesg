import { LEGAL_DOCUMENT, LEGAL_STANDING } from './legal-standing.js';

/**
 * What an answer to S-31's cookie banner is an answer to, and how long it is kept (task 223; `design_spec.md` OQ-27;
 * `architecture.md` §12.5.6's task-223 row (2), (4)). **Here because both tiers read it**: the web sends the version and
 * sets the cookie's expiry, the api admits the version and purges the record, and a figure each kept for itself is two
 * copies free to disagree about what the owner decided once.
 */

/**
 * The cookie policy's version in force — what the banner records an answer to and the api admits. Derived from the
 * standing, so moving the policy's version is the one edit there, and every browser whose answer names the older one is
 * shown the banner again.
 */
export const COOKIE_POLICY_VERSION_IN_FORCE: string = LEGAL_STANDING[LEGAL_DOCUMENT.COOKIES].version;

/**
 * Calendar months an answer lasts: the cookie holding it expires, and the server's row of it is purged, this long after
 * it was given — the owner's *as long as the cookie it proves*. Months rather than seconds because the purge counts them
 * as PostgreSQL does, `interval '12 months'`, and the cookie's expiry is the same calendar date.
 */
export const COOKIE_CHOICE_KEPT_MONTHS = 12;

import { presentNamePart } from './display-name';

/**
 * The setup an account registered through a provider completes before it is active (task 155;
 * §12.5.6's task-155 row, FR-2), as two pure rules.
 *
 * **Complete means held, not submitted.** The account is active once it holds a password and both
 * name parts, whichever route put them there — S-36's two steps, or a password reset that sets the
 * first half (UC-09) and leaves the name to S-36. Keying activation on "both steps were called" would
 * strand exactly that second account, which holds everything and could never be activated.
 *
 * **A name part is present when it has a character that is not whitespace** — `display-name.ts`'s
 * reading, so the chrome and the gate cannot disagree about whether a name was given.
 */

/**
 * How recent the proof for a first password must be (§12.5.6's task-155 row). There is no current
 * password to ask for, so what stands in is a provider sign-in, or a confirmation link, no older than
 * this. A quarter-hour is long enough to type a password and short enough that a session left open on
 * a shared machine cannot be used to plant one days later.
 */
export const ACCOUNT_SETUP_PROOF_WINDOW_MS = 15 * 60 * 1000;

/** What completion is judged on — the credential's existence and the two stored name parts. */
export interface AccountSetupFacts {
  readonly hasPassword: boolean;
  readonly givenName: string | null;
  readonly familyName: string | null;
}

export const setupIsComplete = (facts: AccountSetupFacts): boolean =>
  facts.hasPassword &&
  presentNamePart(facts.givenName) !== null &&
  presentNamePart(facts.familyName) !== null;

/**
 * Whether a proof made at `provedAt` still admits a first password at `now`. Strictly inside the
 * window: at exactly fifteen minutes it has lapsed, the same edge `sessionHasExpired` draws.
 */
export const setupProofIsFresh = (proof: { readonly provedAt: Date }, now: Date): boolean =>
  now.getTime() - proof.provedAt.getTime() < ACCOUNT_SETUP_PROOF_WINDOW_MS;

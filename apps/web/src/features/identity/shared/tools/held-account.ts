/**
 * **In `shared/tools/` on one test — read by more than one journey: `verify/` and `reset/`.**
 *
 * The account this browser still holds a session for once S-02 has completed something for an address
 * (task 160; `design_spec.md` S-02, `architecture.md` §12.5.6's task-160 row). Confirming an address and
 * resetting a password stay reachable while signed in (UX-136), so the success can be reached by a reader
 * signed in as someone else — and its exit to sign-in would then be turned away by the gate, to that
 * someone's home. S-02 names the account instead and offers to switch or to stay.
 *
 * Pure, and free of any directive, because both a Server Action and the Client Component it answers read it.
 */
export interface HeldAccount {
  /** The address the surviving session belongs to — shown to the reader, never compared by the screen. */
  readonly email: string;
  /** Where §4.3's branch sends that session: the link that continues as it. */
  readonly home: string;
}

/**
 * The held account when it is not the one S-02 just confirmed. **Compared case-insensitively**, as the api
 * compares addresses (`emailIdentityKey`) and as S-03's branch does. A signed-in account is always a
 * verified one, so a confirmation reached while signed in is for another address in every case the product
 * can produce today; the comparison states that rather than relying on it.
 */
export const heldAccountOtherThan = (input: {
  readonly held: HeldAccount | null;
  /** The address the action completed for. */
  readonly email: string;
}): HeldAccount | null =>
  input.held !== null && input.held.email.toLowerCase() !== input.email.toLowerCase() ? input.held : null;

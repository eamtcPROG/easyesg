/**
 * The interim seat ceiling's two rules, pure (task 142; `architecture.md` §12.5.6's task-142 row).
 *
 * **What a seat is, stated once:** an active membership, or a pending invitation — **lapsed ones
 * included**. The rows S-16 lists are the rows that hold seats, so the screen and the gate cannot
 * disagree about what is being counted; and a lapsed invitation stays on that list, still holds its
 * address against a re-invite, and is revived by a resend, so a count that let it go would be a count
 * the list and the unpaginated `GET /invitations` both outgrow. The count itself is SQL
 * (`seat.queries.ts`), because it has to see the writes of the transaction asking — this file holds
 * what is decided *about* the number.
 */

/**
 * The artefact's payload, validated rather than cast.
 *
 * **A whole number of at least one, or nothing.** Zero would refuse every invitation while reading
 * as a deliberate setting, and an organization founded under it would already be over its own
 * ceiling with its founder as the only member — so it is malformed rather than strict. A string, a
 * fraction or a missing field is malformed for the plainer reason that configuration is data someone
 * edits. **Null is fail-closed**: the caller refuses the write it was guarding (§12.5.6), and never
 * reads null as unlimited.
 */
export const readSeatAllowance = (payload: Record<string, unknown>): number | null => {
  const { seats } = payload;
  return typeof seats === 'number' && Number.isSafeInteger(seats) && seats >= 1 ? seats : null;
};

export interface SeatLedger {
  /** The organization's ceiling. */
  readonly allowance: number;
  /** Seats held **after** the write being judged — the transaction's own rows counted. */
  readonly held: number;
}

/**
 * Does the organization stay within its allowance once this write commits?
 *
 * **One predicate for both gates, and that is why both check after their write.** An issue counts
 * the invitation it has just inserted, so at the last seat `held` equals the allowance and passes,
 * and one past it fails. An acceptance turns a counted invitation into a counted member, so `held` is
 * unchanged by it — which means it fails only for an organization that was already over its ceiling,
 * never for the ordinary invitee whose seat was taken the moment they were invited. Checking before
 * the write would need a different comparison per gate, and a `+ 1` at acceptance would refuse every
 * invitation accepted at a full organization.
 */
export const withinSeatAllowance = (ledger: SeatLedger): boolean =>
  ledger.held <= ledger.allowance;

/**
 * The email address as the account's identifier (FR-1).
 *
 * Two operations, and the split between them is the decision. `normaliseEmail` produces what is
 * **stored and displayed**; `emailIdentityKey` produces what is **compared**. They differ in case,
 * and collapsing them would be wrong in one direction or the other: lower-casing what is stored
 * means addressing mail to someone whose name the platform silently reformatted, while comparing
 * with case means `Ana@example.md` and `ana@example.md` become two accounts for one person.
 *
 * The database holds the same split — `identity.account.email` keeps the case, and uniqueness is a
 * functional index on `lower(email)`. This file exists so the application never disagrees with it.
 *
 * Format validation is not here. It belongs to the request DTO, where `class-validator` already
 * has a well-tested implementation, and re-deciding what an address is would be a second answer to
 * a question nothing in this product actually asks.
 */

export function normaliseEmail(raw: string): string {
  return raw.trim();
}

/** Must match `lower(email)` in `account_email_key`. Change one and you change both. */
export function emailIdentityKey(email: string): string {
  return normaliseEmail(email).toLowerCase();
}

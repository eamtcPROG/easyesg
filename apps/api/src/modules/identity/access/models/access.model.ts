import { MEMBERSHIP_ROLE, type MembershipRole } from '@api/modules/identity/membership/models/membership.model';

/**
 * S-16's read model — *"who can see our ESG data"*, as **one list over two tables** (FR-56, UC-59).
 *
 * **Why this module exists at all** (task 131). FR-56 asks for every user with access *"and their
 * status, active or pending invitation"*, and task 25.1's migration recorded in advance that the
 * union belongs in a read model. Until now that read model lived in `apps/web`: the browser tier
 * fetched `GET /members` and `GET /invitations` whole and did the filter, the sort and the page
 * arithmetic in a Server Component. That works and is what shipped — the collection is bounded by
 * the organization's seat ceiling — but it cannot be made server-side by adding parameters to the two
 * endpoints, because **page 2 of members unioned with page 2 of invitations is not page 2 of the
 * union**, and a sort spanning both cannot be resolved from two separately-ordered responses.
 *
 * So the union is computed where a union can be: in one SQL statement, under RLS, with the filter,
 * the order and the window applied to the merged set.
 *
 * **The two halves are a discriminated union rather than a flattened row with nullable columns.**
 * They genuinely differ in two facts, and `expiresAt` on a member is not a null — it is a question
 * that does not apply. Flat, every consumer has to remember which fields the standing makes
 * meaningful; as a union the compiler remembers instead.
 */
export const ACCESS_ROW_KIND = {
  /** Someone who holds access now — a row of `identity.membership`. */
  MEMBER: 'member',
  /** Someone invited who has not accepted. Not a member of anything yet, and not counted as one. */
  INVITATION: 'invitation',
} as const;

export type AccessRowKind = (typeof ACCESS_ROW_KIND)[keyof typeof ACCESS_ROW_KIND];

/**
 * What the status column says, and why it has three values where FR-56 names two.
 *
 * `GET /invitations` publishes **every pending row, expired ones included**, and its use case states
 * why: an expired invitation is what refuses a re-invite with a 409, so hiding it would leave an
 * administrator holding a conflict they cannot see, cannot resend and cannot revoke. The screen must
 * therefore tell a live invitation from a lapsed one, and the resolutions differ — a lapsed one
 * wants a resend, which mints a fresh link and restarts the seven days.
 *
 * **Derived in SQL from `now()`, which is the one clock.** It was computed in the browser tier
 * against `Date.now()` until task 131; moving the filter to the server without moving the derivation
 * would let a row be *filtered* as live and *rendered* as expired on the same request.
 */
export const ACCESS_STANDING = {
  /** Accepted, and holding the role shown. */
  ACTIVE: 'active',
  /** Invited, link still live. */
  INVITED: 'invited',
  /** Invited, past its seven days. A resend mints a fresh link; nothing else revives this one. */
  INVITATION_EXPIRED: 'invitation_expired',
} as const;

export type AccessStanding = (typeof ACCESS_STANDING)[keyof typeof ACCESS_STANDING];

/**
 * The dimensions this list may be ordered by — the Index archetype's sortable columns (§4.6).
 *
 * Named for what the reader sorts by rather than for the column it lands on, because two of them
 * are not columns: `role` and `standing` order by a **rank** the product defines (widest access
 * first; needing-attention first), not alphabetically, and `activity` is a coalesce across the two
 * halves of the union.
 */
export const ACCESS_SORT = {
  PERSON: 'person',
  ROLE: 'role',
  STANDING: 'standing',
  ACTIVITY: 'activity',
} as const;

export type AccessSort = (typeof ACCESS_SORT)[keyof typeof ACCESS_SORT];

/** Both filters accept this to mean "no filter" — a value rather than an absence, per UX-4. */
export const ACCESS_FILTER_ANY = 'any';

/** The filter fields this route understands, as the compact list format spells them. */
export const ACCESS_FILTER_FIELD = {
  ROLE: 'role',
  STANDING: 'standing',
} as const;

export type AccessFilterField =
  (typeof ACCESS_FILTER_FIELD)[keyof typeof ACCESS_FILTER_FIELD];

export interface AccessRowShared {
  /** The handle every row action needs — a membership id or an invitation id. */
  readonly id: string;
  readonly email: string;
  readonly role: MembershipRole;
  readonly standing: AccessStanding;
}

export interface MemberAccessRow extends AccessRowShared {
  readonly kind: typeof ACCESS_ROW_KIND.MEMBER;
  readonly standing: typeof ACCESS_STANDING.ACTIVE;
  readonly accountId: string;
  /**
   * UX-137's derived name, never empty: it falls back to `email` for an account that has none, so
   * a surface renders this and shows the address beside it rather than choosing between them.
   *
   * **It sits on this half only**, which is the union earning its keep again: an invitation has no
   * account, so it has no name — *not known*, rather than *absent and defaulted*. Flattening it
   * with a nullable would make every consumer re-derive which standing makes it meaningful.
   */
  readonly displayName: string;
  /** Null for a member who has not made a request since access was granted. */
  readonly lastActiveAt: Date | null;
  readonly joinedAt: Date;
}

export interface InvitationAccessRow extends AccessRowShared {
  readonly kind: typeof ACCESS_ROW_KIND.INVITATION;
  /** The most recent issue or resend — a resend moves this and restarts the window. */
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export type AccessRow = MemberAccessRow | InvitationAccessRow;

/** What the store is asked for: the window, the order and the two facets. */
export interface AccessQuery {
  readonly role: MembershipRole | typeof ACCESS_FILTER_ANY;
  readonly standing: AccessStanding | typeof ACCESS_FILTER_ANY;
  readonly sort: AccessSort;
  readonly descending: boolean;
  readonly skip: number;
  readonly take: number;
}

/**
 * One page, and **two counts that answer different questions**.
 *
 * `matched` is how many rows the filter admits, which is what a pager divides. `total` is how many
 * there are at all, which is what tells an empty result whether it is *"nobody has been invited
 * yet"* or *"your filter matched nobody"* — §4.6 requires an Index to have an empty state that
 * teaches, and those two teach opposite things.
 */
export interface AccessPage {
  readonly rows: readonly AccessRow[];
  readonly matched: number;
  readonly total: number;
}

/** Membership decided from the object, so a role added there is accepted here by construction. */
export const isMembershipRole = (value: string): value is MembershipRole =>
  (Object.values(MEMBERSHIP_ROLE) as string[]).includes(value);

export const isAccessStanding = (value: string): value is AccessStanding =>
  (Object.values(ACCESS_STANDING) as string[]).includes(value);

export const isAccessSort = (value: string): value is AccessSort =>
  (Object.values(ACCESS_SORT) as string[]).includes(value);

import type { IndexPage } from '@easyesg/ui';
import {
  INVITED_ROLE,
  MEMBERSHIP_ROLE,
  type Invitation,
  type InvitedRole,
  type Member,
  type MembershipRole,
} from '@easyesg/contracts';

/**
 * S-16's read model — "who can see our ESG data", as one list (FR-56, UC-59 … UC-64).
 *
 * **The union is the screen.** `identity.membership` and `identity.invitation` are two tables with
 * two lifecycles, and task 25.1's migration recorded in advance that FR-56's *"active or pending
 * invitation"* is one list assembled across them in the read model. That is why task 26.4 owns the
 * whole screen rather than half of it: split across tasks, this file would have been written twice
 * and one copy thrown away.
 *
 * **Pure, and carrying no `server-only`.** Everything here is a rule over data someone else
 * fetched — `server/data/organization-access.ts` is the seam that reaches the API. That split is
 * the same one `features/identity/post-sign-in.ts` makes and for the same reason: importing the
 * API client would make the whole module unloadable in a test, so the filter, the sort, the page
 * arithmetic and the standing rule would be exercised only through a browser, and the branches
 * that are not the happy path would not be exercised at all.
 */

export const ACCESS_ROW_KIND = {
  /** Someone who holds access now — a row of `identity.membership`. */
  MEMBER: 'member',
  /** Someone invited who has not accepted. Not a member of anything yet, and not counted as one. */
  INVITATION: 'invitation',
} as const;

export type AccessRowKind = (typeof ACCESS_ROW_KIND)[keyof typeof ACCESS_ROW_KIND];

/**
 * What the status column says, and the reason it has three values where FR-56 names two.
 *
 * `GET /invitations` publishes **every pending row, expired ones included** — its use case states
 * why: an expired invitation is what refuses a re-invite with a 409, so hiding it would leave an
 * administrator holding a conflict they cannot see, cannot resend and cannot revoke. So the screen
 * must tell a live invitation from a lapsed one; showing both as "invited" would reproduce the
 * dead end one layer up. The resolution differs too — a lapsed one wants a resend, which mints a
 * fresh link and restarts the seven days.
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

interface AccessRowShared {
  /** The handle every row action needs — a membership id or an invitation id. */
  readonly id: string;
  readonly email: string;
  readonly role: MembershipRole;
}

export interface MemberRow extends AccessRowShared {
  readonly kind: typeof ACCESS_ROW_KIND.MEMBER;
  readonly accountId: string;
  /** Null for a member who has not made a request since access was granted. */
  readonly lastActiveAt: number | null;
  readonly joinedAt: number;
}

export interface InvitationRow extends AccessRowShared {
  readonly kind: typeof ACCESS_ROW_KIND.INVITATION;
  readonly role: InvitedRole;
  /** The most recent issue or resend — a resend moves this and restarts the window. */
  readonly issuedAt: number;
  readonly expiresAt: number;
}

/**
 * A union rather than a flattened row with optional fields. The two halves genuinely differ in two
 * facts, and `expiresAt` on a member is not a null — it is a question that does not apply. Flat,
 * every consumer would have to remember which fields the standing makes meaningful; as a union the
 * compiler remembers instead.
 */
export type AccessRow = MemberRow | InvitationRow;

/**
 * A row's identity across the union.
 *
 * The two halves come from different tables, so an id alone is only unique within its own — and
 * qualifying it is what lets one key serve the table's `rowKey`, the per-row pending state and any
 * later selection without three functions that must agree.
 */
export const accessRowKey = (row: AccessRow): string => `${row.kind}:${row.id}`;

export const accessStanding = (row: AccessRow, now: number): AccessStanding => {
  if (row.kind === ACCESS_ROW_KIND.MEMBER) return ACCESS_STANDING.ACTIVE;
  return row.expiresAt <= now ? ACCESS_STANDING.INVITATION_EXPIRED : ACCESS_STANDING.INVITED;
};

/**
 * The instant the activity column shows and sorts on.
 *
 * A member's is their last request, falling back to when they joined — a member who has never
 * signed in is not undated, they are dated from the grant, and sorting them to the bottom of a
 * list ordered by recency would be a lie about when they appeared. An invitation's is when it was
 * last sent, which a resend moves; that is the same fact the column means for both, which is what
 * lets one column head cover the union honestly.
 */
export const accessActivityAt = (row: AccessRow): number =>
  row.kind === ACCESS_ROW_KIND.MEMBER ? (row.lastActiveAt ?? row.joinedAt) : row.issuedAt;

export const toAccessRows = (input: {
  readonly members: readonly Member[];
  readonly invitations: readonly Invitation[];
}): AccessRow[] => [
  ...input.members.map(
    (member): MemberRow => ({
      kind: ACCESS_ROW_KIND.MEMBER,
      id: member.id,
      accountId: member.accountId,
      email: member.email,
      role: member.role,
      lastActiveAt: member.lastActiveAt ?? null,
      joinedAt: member.joinedAt,
    }),
  ),
  ...input.invitations.map(
    (invitation): InvitationRow => ({
      kind: ACCESS_ROW_KIND.INVITATION,
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      issuedAt: invitation.issuedAt,
      expiresAt: invitation.expiresAt,
    }),
  ),
];

/**
 * The filter's "no filter" value.
 *
 * A real member of each vocabulary rather than the empty string, because the Radix `Select` that
 * renders it reserves `''` for "reset to the placeholder" and refuses an option that uses it —
 * and because a filter whose unset state is a value can be read from the URL without a special
 * case (UX-4: every addressable state is in the URL, including the one that shows everything).
 */
export const ACCESS_FILTER_ANY = 'any';

export const ACCESS_SORT = {
  PERSON: 'person',
  ROLE: 'role',
  STANDING: 'standing',
  ACTIVITY: 'activity',
} as const;

export type AccessSort = (typeof ACCESS_SORT)[keyof typeof ACCESS_SORT];

export const ACCESS_SORT_DIRECTION = {
  ASCENDING: 'asc',
  DESCENDING: 'desc',
} as const;

export type AccessSortDirection =
  (typeof ACCESS_SORT_DIRECTION)[keyof typeof ACCESS_SORT_DIRECTION];

/** Enough rows that an ordinary organization is one page, few enough that the control is real. */
export const ACCESS_PAGE_SIZE = 25;

export interface AccessView {
  readonly role: MembershipRole | typeof ACCESS_FILTER_ANY;
  readonly standing: AccessStanding | typeof ACCESS_FILTER_ANY;
  readonly sort: AccessSort;
  readonly direction: AccessSortDirection;
  readonly page: number;
}

/** Recency first: an administrator opening this screen is looking at who is here now. */
export const DEFAULT_ACCESS_VIEW: AccessView = {
  role: ACCESS_FILTER_ANY,
  standing: ACCESS_FILTER_ANY,
  sort: ACCESS_SORT.ACTIVITY,
  direction: ACCESS_SORT_DIRECTION.DESCENDING,
  page: 1,
};

const oneOf = <T extends string>(values: readonly T[], candidate: unknown): T | null =>
  typeof candidate === 'string' && (values as readonly string[]).includes(candidate)
    ? (candidate as T)
    : null;

const ROLE_FILTERS = [ACCESS_FILTER_ANY, ...Object.values(MEMBERSHIP_ROLE)] as const;
const STANDING_FILTERS = [ACCESS_FILTER_ANY, ...Object.values(ACCESS_STANDING)] as const;

/**
 * The view state, read from the URL and never trusted.
 *
 * Every member is derived from its vocabulary rather than restated, so adding a role adds a filter
 * value with no edit here. An unreadable parameter falls back to the default rather than erroring:
 * a hand-edited or stale query string should show the list, not a screen about the query string.
 */
export const readAccessView = (params: Record<string, string | string[] | undefined>): AccessView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(single('page') ?? '', 10);

  return {
    role: oneOf(ROLE_FILTERS, single('role')) ?? DEFAULT_ACCESS_VIEW.role,
    standing: oneOf(STANDING_FILTERS, single('standing')) ?? DEFAULT_ACCESS_VIEW.standing,
    sort: oneOf(Object.values(ACCESS_SORT), single('sort')) ?? DEFAULT_ACCESS_VIEW.sort,
    direction:
      oneOf(Object.values(ACCESS_SORT_DIRECTION), single('dir')) ?? DEFAULT_ACCESS_VIEW.direction,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_ACCESS_VIEW.page,
  };
};

/** The query string for a view, omitting whatever equals the default — so a bare `/…/users` and
 *  the default view are the same address rather than two spellings of it. */
export const accessViewQuery = (view: AccessView): string => {
  const params = new URLSearchParams();
  if (view.role !== DEFAULT_ACCESS_VIEW.role) params.set('role', view.role);
  if (view.standing !== DEFAULT_ACCESS_VIEW.standing) params.set('standing', view.standing);
  if (view.sort !== DEFAULT_ACCESS_VIEW.sort) params.set('sort', view.sort);
  if (view.direction !== DEFAULT_ACCESS_VIEW.direction) params.set('dir', view.direction);
  if (view.page !== DEFAULT_ACCESS_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/** Role order for sorting: the widest access first, so "who can change things" reads off the top. */
const ROLE_RANK: Record<MembershipRole, number> = {
  [MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR]: 0,
  [MEMBERSHIP_ROLE.EDITOR]: 1,
  [MEMBERSHIP_ROLE.VIEWER]: 2,
};

/** Standing order: the rows needing attention first, which is the order the chips' tones imply. */
const STANDING_RANK: Record<AccessStanding, number> = {
  [ACCESS_STANDING.INVITATION_EXPIRED]: 0,
  [ACCESS_STANDING.INVITED]: 1,
  [ACCESS_STANDING.ACTIVE]: 2,
};

/**
 * What one page of the list is — **`IndexPage` from `packages/ui`, plus the page count.**
 *
 * The five members the shell reads are its contract rather than this module's invention, so the
 * read model produces them by name instead of the screen translating between two shapes. Adopted
 * 26 Aug 2026 with the Index archetype; `pageCount` stays local because only the clamp below uses
 * it — the pager derives its own from `matched` and `pageSize`.
 */
export interface AccessPage extends IndexPage<AccessRow> {
  readonly pageCount: number;
}

/**
 * Filter, sort and page — in the read model, because the API does neither.
 *
 * Both collections are unpaginated by design: their use cases record that the set is bounded by
 * the plan's seat entitlement, so the whole list arrives and there is nothing to ask the server
 * for. The Index archetype still owes its reader a filter, a sort and a pager (§4.6), and task
 * 26.4's batch decided to ship them in full rather than the subset the API happens to make free.
 *
 * `page` is clamped rather than validated: a reader who filters while on page 3 must land on the
 * last page that exists, not on an empty one that reads as "no matches".
 */
export const applyAccessView = (input: {
  readonly rows: readonly AccessRow[];
  readonly view: AccessView;
  readonly now: number;
}): AccessPage => {
  const { rows, view, now } = input;

  const matched = rows.filter((row) => {
    const roleMatches = view.role === ACCESS_FILTER_ANY || row.role === view.role;
    const standingMatches =
      view.standing === ACCESS_FILTER_ANY || accessStanding(row, now) === view.standing;
    return roleMatches && standingMatches;
  });

  const ordered = matched.toSorted((left, right) => {
    const by = compareBy(left, right, view.sort, now);
    // Email is the tie-break everywhere, so the order is total and a re-render cannot reshuffle
    // equal rows under the reader's cursor.
    const settled = by !== 0 ? by : left.email.localeCompare(right.email);
    return view.direction === ACCESS_SORT_DIRECTION.ASCENDING ? settled : -settled;
  });

  const pageCount = Math.max(1, Math.ceil(ordered.length / ACCESS_PAGE_SIZE));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const from = (page - 1) * ACCESS_PAGE_SIZE;

  return {
    rows: ordered.slice(from, from + ACCESS_PAGE_SIZE),
    matched: ordered.length,
    total: rows.length,
    page,
    pageCount,
    pageSize: ACCESS_PAGE_SIZE,
  };
};

function compareBy(left: AccessRow, right: AccessRow, sort: AccessSort, now: number): number {
  switch (sort) {
    case ACCESS_SORT.PERSON:
      return left.email.localeCompare(right.email);
    case ACCESS_SORT.ROLE:
      return ROLE_RANK[left.role] - ROLE_RANK[right.role];
    case ACCESS_SORT.STANDING:
      return STANDING_RANK[accessStanding(left, now)] - STANDING_RANK[accessStanding(right, now)];
    default:
      return accessActivityAt(left) - accessActivityAt(right);
  }
}

/**
 * FR-60's lockout rule, on the screen's side of the wire.
 *
 * The API owns it — one domain predicate shared by demotion and removal (task 25.2) — and refuses
 * either with a problem document. This exists so the screen does not *offer* the action it knows
 * will be refused: UX asks that a control which cannot succeed not be presented as though it can.
 * It is a mirror of a server rule and never the rule itself; the refusal remains authoritative,
 * because between this render and that request someone else may have been demoted.
 */
export const isLastAdministrator = (input: {
  readonly rows: readonly AccessRow[];
  readonly row: AccessRow;
}): boolean =>
  input.row.role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR &&
  input.rows.filter(
    (candidate) =>
      candidate.kind === ACCESS_ROW_KIND.MEMBER &&
      candidate.role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
  ).length <= 1;

/** The roles an invitation may carry, in the order the form offers them. */
export const INVITABLE_ROLES = Object.values(INVITED_ROLE);

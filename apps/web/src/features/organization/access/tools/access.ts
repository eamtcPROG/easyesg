import type { IndexPage } from '@easyesg/ui';
import type { ListQuery } from '@/lib/pagination';
import {
  INVITED_ROLE,
  MEMBERSHIP_ROLE,
  type MembershipRole,
} from '@easyesg/contracts';

/**
 * S-16's read model — "who can see our ESG data", as one list (FR-56, UC-59 … UC-64).
 *
 * **In `tools/` since task 127**, the third screen of this feature to take the shape S-05 took in
 * task 126: `components/` renders, `tools/` is pure, `actions/` writes, and no directory holds files
 * and folders at once. These four files are the pure half — their specs run with no DOM, no server
 * and no network, which is what the paragraph below already said about them before they had a
 * folder to say it from.
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
  /**
   * **Derived by the server, never recomputed here** (task 131).
   *
   * It was `accessStanding(row, now)` in this module until the filter moved to the API. Keeping
   * that function would have left two clocks deciding one fact: the database's `now()` admitting a
   * row to the *"invited"* facet and the browser's `Date.now()` drawing it as expired, on the same
   * response. The screen renders what the filter matched on.
   */
  readonly standing: AccessStanding;
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
  /**
   * **`MembershipRole`, not `InvitedRole`, since task 131** — and the widening is the wire being
   * honest rather than the screen giving something up. A merged list publishes **one** role
   * vocabulary, because a flat row cannot carry a different enum per `kind`; what keeps an
   * invitation's role inside the invitable subset is `invitation_role_known` on the table, which is
   * a fact about the database that the wire has no way to state per-kind.
   *
   * Nothing on this screen reads it more narrowly — the cell renders a label. `INVITABLE_ROLES`
   * below is what the invite *form* offers, and that is where the narrower set actually belongs.
   */
  readonly role: MembershipRole;
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

/**
 * Every sortable column, plus the row-action column that is not.
 *
 * Spread from `ACCESS_SORT` rather than restated, so a new sort dimension becomes a column with no
 * edit here — and so the two cannot disagree about how a column is spelled, which is what the
 * `sort=` parameter and the header both read.
 */
export const ACCESS_COLUMN = { ...ACCESS_SORT, ACTIONS: 'actions' } as const;

export type AccessColumnKey = (typeof ACCESS_COLUMN)[keyof typeof ACCESS_COLUMN];

/**
 * **Declared here rather than beside `useAccessColumns`, and that is the client-boundary rule
 * rather than tidiness** (4 Sep 2026, task 74.1's convention review). `access-columns.tsx` carries
 * `'use client'`, so every export it makes is a client reference: a Server Component reading this
 * object would get `undefined`, silently, past every gate — see `CLAUDE.md` under "A closed
 * vocabulary is declared once". Nothing on the server reads it today, which is exactly the state
 * `packages/ui`'s four vocabularies were in when the first server reader arrived and found them.
 *
 * It also puts the derivation next to its source: `ACCESS_SORT` is directly above.
 */
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

/**
 * What one page of the list is — **`IndexPage` from `packages/ui`, plus the administrator count.**
 *
 * The five members the shell reads are its contract rather than this module's invention, so the
 * read model produces them by name instead of the screen translating between two shapes. Adopted
 * 26 Aug 2026 with the Index archetype; since task 131 every member is **answered by the API**
 * rather than computed here, which is what moving the filter, the order and the window server-side
 * means in practice.
 *
 * `administrators` is the one addition, and it is here because **server-side paging broke the rule
 * that used to be derivable**: `isLastAdministrator` counted administrators among the rows it was
 * given, which was every row while the browser held the whole list. Under paging those rows are one
 * page, so an organization whose only administrator sits on page 2 would be offered a demotion on
 * page 1 that the API then refuses. The count is a fact about the organization, not about the page.
 */
export interface AccessPage extends IndexPage<AccessRow> {
  /** How many active administrators the organization has — FR-60's rule needs the whole set. */
  readonly administrators: number;
}

/**
 * The view, as the API's compact list query (§6.8; task 131).
 *
 * **The exact inverse of `ListQueryInterceptor`, through `buildListQuery`** — which has existed
 * since task 11 with its docblock promising *"the URL→`ListQuery` parse arrives with the first
 * index screen"*. This is that screen, and this function is the parse.
 *
 * A facet equal to `ACCESS_FILTER_ANY` is **omitted rather than sent**: the API reads a missing
 * facet as unset, and sending the sentinel would make `any` a value the server has to know about.
 * That keeps `ACCESS_FILTER_ANY` what it is — this screen's spelling of "no filter" in a URL, where
 * UX-4 requires even the unset state to be addressable.
 */
export const accessListQuery = (view: AccessView): ListQuery => ({
  filters: [
    ...(view.role === ACCESS_FILTER_ANY ? [] : [{ field: 'role', values: [view.role] }]),
    ...(view.standing === ACCESS_FILTER_ANY ? [] : [{ field: 'standing', values: [view.standing] }]),
  ],
  order: [{ field: view.sort, direction: view.direction }],
  page: view.page,
  onpage: ACCESS_PAGE_SIZE,
});

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
  /** The organization's count, from the read — **not** the rows on screen. See `AccessPage`. */
  readonly administrators: number;
  readonly row: AccessRow;
}): boolean =>
  input.row.kind === ACCESS_ROW_KIND.MEMBER &&
  input.row.role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR &&
  input.administrators <= 1;

/** The roles an invitation may carry, in the order the form offers them. */
export const INVITABLE_ROLES = Object.values(INVITED_ROLE);

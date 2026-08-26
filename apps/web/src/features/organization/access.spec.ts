import { MEMBERSHIP_ROLE, type Invitation, type Member } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_FILTER_ANY,
  ACCESS_PAGE_SIZE,
  ACCESS_ROW_KIND,
  ACCESS_SORT,
  ACCESS_SORT_DIRECTION,
  ACCESS_STANDING,
  DEFAULT_ACCESS_VIEW,
  accessActivityAt,
  accessStanding,
  accessViewQuery,
  applyAccessView,
  isLastAdministrator,
  readAccessView,
  toAccessRows,
  type AccessRow,
} from './access';

/**
 * S-16's read model. Pure by design, so all of this is a spec rather than a browser journey —
 * which is the whole reason `server/data/organization-access.ts` holds the fetching and this holds
 * the rules (`features/identity/post-sign-in.ts` makes the same split).
 *
 * The cases that matter are the ones a happy-path browser test would never reach: the lapsed
 * invitation the API deliberately publishes, a filter that empties the current page, a URL someone
 * hand-edited, and FR-60's lockout seen from the screen's side.
 */
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_780_000_000_000;

const member = (over: Partial<Member> = {}): Member => ({
  id: `m-${over.email ?? 'ana'}`,
  accountId: 'acc-1',
  email: 'ana@example.md',
  role: MEMBERSHIP_ROLE.EDITOR,
  status: 'active',
  lastActiveAt: NOW - DAY,
  joinedAt: NOW - 30 * DAY,
  ...over,
});

const invitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: `i-${over.email ?? 'bogdan'}`,
  email: 'bogdan@example.md',
  role: MEMBERSHIP_ROLE.VIEWER,
  issuedAt: NOW - DAY,
  expiresAt: NOW + 6 * DAY,
  ...over,
});

const rowsOf = (members: Member[], invitations: Invitation[]): AccessRow[] =>
  toAccessRows({ members, invitations });

const view = (over: Partial<typeof DEFAULT_ACCESS_VIEW> = {}) => ({
  ...DEFAULT_ACCESS_VIEW,
  ...over,
});

describe('access · the union', () => {
  it('makes one list from two collections, keeping each side identifiable', () => {
    const rows = rowsOf([member()], [invitation()]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.kind)).toEqual([
      ACCESS_ROW_KIND.MEMBER,
      ACCESS_ROW_KIND.INVITATION,
    ]);
  });

  it('reads a member who has never signed in as dated from the grant, not as undated', () => {
    const [row] = rowsOf([member({ lastActiveAt: null })], []);
    expect(accessActivityAt(row)).toBe(NOW - 30 * DAY);
  });
});

describe('access · standing', () => {
  it('calls a member active', () => {
    const [row] = rowsOf([member()], []);
    expect(accessStanding(row, NOW)).toBe(ACCESS_STANDING.ACTIVE);
  });

  it('tells a live invitation from a lapsed one', () => {
    const [live, lapsed] = rowsOf(
      [],
      [invitation({ email: 'live@example.md' }), invitation({ email: 'old@example.md', expiresAt: NOW - DAY })],
    );

    expect(accessStanding(live, NOW)).toBe(ACCESS_STANDING.INVITED);
    expect(accessStanding(lapsed, NOW)).toBe(ACCESS_STANDING.INVITATION_EXPIRED);
  });

  /**
   * The reason this distinction exists at all. `GET /invitations` publishes every pending row,
   * expired ones included, because an expired invitation is what refuses a re-invite with a 409 —
   * so hiding it, or showing it as an ordinary "invited", leaves an administrator holding a
   * conflict they cannot see, cannot resend and cannot revoke.
   */
  it('keeps a lapsed invitation in the list rather than dropping it', () => {
    const rows = rowsOf([], [invitation({ expiresAt: NOW - DAY })]);
    const page = applyAccessView({ rows, view: view(), now: NOW });

    expect(page.rows).toHaveLength(1);
    expect(page.matched).toBe(1);
  });
});

describe('access · the view', () => {
  it('filters by role', () => {
    const rows = rowsOf(
      [
        member({ email: 'ana@example.md', role: MEMBERSHIP_ROLE.EDITOR }),
        member({ email: 'ion@example.md', role: MEMBERSHIP_ROLE.VIEWER }),
      ],
      [],
    );

    const page = applyAccessView({
      rows,
      view: view({ role: MEMBERSHIP_ROLE.VIEWER }),
      now: NOW,
    });

    expect(page.rows.map((row) => row.email)).toEqual(['ion@example.md']);
    expect(page.matched).toBe(1);
    expect(page.total).toBe(2);
  });

  it('filters by standing', () => {
    const rows = rowsOf([member()], [invitation({ expiresAt: NOW - DAY })]);

    const page = applyAccessView({
      rows,
      view: view({ standing: ACCESS_STANDING.INVITATION_EXPIRED }),
      now: NOW,
    });

    expect(page.matched).toBe(1);
    expect(page.rows[0].kind).toBe(ACCESS_ROW_KIND.INVITATION);
  });

  /** `total` is what tells first use apart from a filter with no hits — two different screens. */
  it('reports the unfiltered total beside the matched count', () => {
    const rows = rowsOf([member()], []);
    const page = applyAccessView({
      rows,
      view: view({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
      now: NOW,
    });

    expect(page.matched).toBe(0);
    expect(page.total).toBe(1);
  });

  it('sorts by person, and reverses on direction', () => {
    const rows = rowsOf(
      [member({ email: 'zeta@example.md' }), member({ email: 'alpha@example.md' })],
      [],
    );

    const ascending = applyAccessView({
      rows,
      view: view({ sort: ACCESS_SORT.PERSON, direction: ACCESS_SORT_DIRECTION.ASCENDING }),
      now: NOW,
    });
    const descending = applyAccessView({
      rows,
      view: view({ sort: ACCESS_SORT.PERSON, direction: ACCESS_SORT_DIRECTION.DESCENDING }),
      now: NOW,
    });

    expect(ascending.rows.map((row) => row.email)).toEqual([
      'alpha@example.md',
      'zeta@example.md',
    ]);
    expect(descending.rows.map((row) => row.email)).toEqual([
      'zeta@example.md',
      'alpha@example.md',
    ]);
  });

  it('puts the widest access first when sorting by role', () => {
    const rows = rowsOf(
      [
        member({ email: 'v@example.md', role: MEMBERSHIP_ROLE.VIEWER }),
        member({ email: 'a@example.md', role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
        member({ email: 'e@example.md', role: MEMBERSHIP_ROLE.EDITOR }),
      ],
      [],
    );

    const page = applyAccessView({
      rows,
      view: view({ sort: ACCESS_SORT.ROLE, direction: ACCESS_SORT_DIRECTION.ASCENDING }),
      now: NOW,
    });

    expect(page.rows.map((row) => row.role)).toEqual([
      MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      MEMBERSHIP_ROLE.EDITOR,
      MEMBERSHIP_ROLE.VIEWER,
    ]);
  });

  /** A total order, so a re-render cannot reshuffle equal rows under the reader's cursor. */
  it('breaks ties on email so the order is stable', () => {
    const rows = rowsOf(
      [
        member({ email: 'b@example.md', lastActiveAt: NOW }),
        member({ email: 'a@example.md', lastActiveAt: NOW }),
      ],
      [],
    );

    const page = applyAccessView({
      rows,
      view: view({ sort: ACCESS_SORT.ACTIVITY, direction: ACCESS_SORT_DIRECTION.ASCENDING }),
      now: NOW,
    });

    expect(page.rows.map((row) => row.email)).toEqual(['a@example.md', 'b@example.md']);
  });

  it('pages, and clamps a page beyond the end onto the last one that exists', () => {
    const rows = rowsOf(
      Array.from({ length: ACCESS_PAGE_SIZE + 3 }, (_, index) =>
        member({ email: `person-${String(index).padStart(2, '0')}@example.md` }),
      ),
      [],
    );

    const second = applyAccessView({ rows, view: view({ page: 2 }), now: NOW });
    expect(second.rows).toHaveLength(3);
    expect(second.pageCount).toBe(2);

    // The case that matters: a filter applied from page 9 must not render "no matches".
    const beyond = applyAccessView({ rows, view: view({ page: 9 }), now: NOW });
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(3);
  });
});

describe('access · the URL', () => {
  it('reads a view from search params', () => {
    expect(
      readAccessView({
        role: MEMBERSHIP_ROLE.VIEWER,
        standing: ACCESS_STANDING.INVITED,
        sort: ACCESS_SORT.PERSON,
        dir: ACCESS_SORT_DIRECTION.ASCENDING,
        page: '3',
      }),
    ).toEqual({
      role: MEMBERSHIP_ROLE.VIEWER,
      standing: ACCESS_STANDING.INVITED,
      sort: ACCESS_SORT.PERSON,
      direction: ACCESS_SORT_DIRECTION.ASCENDING,
      page: 3,
    });
  });

  /** A hand-edited or stale query string shows the list, not a screen about the query string. */
  it('falls back to the default for anything it cannot read', () => {
    expect(
      readAccessView({ role: 'sysadmin', standing: '', sort: '../../etc', dir: 'sideways', page: '-4' }),
    ).toEqual(DEFAULT_ACCESS_VIEW);
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(readAccessView({ role: [MEMBERSHIP_ROLE.VIEWER, MEMBERSHIP_ROLE.EDITOR] }).role).toBe(
      MEMBERSHIP_ROLE.VIEWER,
    );
  });

  /** The default view and a bare path are one address, not two spellings of it. */
  it('writes nothing for the default view', () => {
    expect(accessViewQuery(DEFAULT_ACCESS_VIEW)).toBe('');
  });

  it('round-trips a non-default view', () => {
    const chosen = view({ role: MEMBERSHIP_ROLE.EDITOR, page: 2, sort: ACCESS_SORT.STANDING });
    const query = Object.fromEntries(new URLSearchParams(accessViewQuery(chosen)));

    expect(readAccessView(query)).toEqual(chosen);
  });

  it('keeps "any" out of the query, since it is the default', () => {
    expect(accessViewQuery(view({ role: ACCESS_FILTER_ANY }))).toBe('');
  });
});

describe('access · FR-60 seen from the screen', () => {
  it('locks the sole administrator', () => {
    const rows = rowsOf(
      [
        member({ email: 'sole@example.md', role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
        member({ email: 'other@example.md', role: MEMBERSHIP_ROLE.EDITOR }),
      ],
      [],
    );

    expect(isLastAdministrator({ rows, row: rows[0] })).toBe(true);
    expect(isLastAdministrator({ rows, row: rows[1] })).toBe(false);
  });

  it('unlocks once a second administrator exists', () => {
    const rows = rowsOf(
      [
        member({ email: 'a@example.md', role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
        member({ email: 'b@example.md', role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR }),
      ],
      [],
    );

    expect(isLastAdministrator({ rows, row: rows[0] })).toBe(false);
  });

  /**
   * An invitation at administrator level cannot exist (FR-57 admits edit and view-only only), but
   * the predicate counts *members* explicitly rather than relying on that — the rule it mirrors is
   * about who can administer the organization now, and someone who has not accepted cannot.
   */
  it('does not count an unaccepted invitation as an administrator', () => {
    const rows: AccessRow[] = [
      ...rowsOf([member({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR })], []),
      {
        kind: ACCESS_ROW_KIND.INVITATION,
        id: 'i-1',
        email: 'pending@example.md',
        role: MEMBERSHIP_ROLE.EDITOR,
        issuedAt: NOW,
        expiresAt: NOW + DAY,
      },
    ];

    expect(isLastAdministrator({ rows, row: rows[0] })).toBe(true);
  });
});

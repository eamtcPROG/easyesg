import { MEMBERSHIP_ROLE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_FILTER_ANY,
  ACCESS_PAGE_SIZE,
  ACCESS_ROW_KIND,
  ACCESS_SORT,
  ACCESS_SORT_DIRECTION,
  ACCESS_STANDING,
  DEFAULT_ACCESS_VIEW,
  accessListQuery,
  accessRowKey,
  accessViewQuery,
  isLastAdministrator,
  readAccessView,
  type AccessRow,
  type MemberRow,
} from './access';

/**
 * S-16's read model, after task 131 moved the filter, the sort and the page to the API.
 *
 * **Two thirds of this file went with them, and that is the deliverable rather than a loss.** The
 * union, the standing derivation, the ordering, the tie-break and the page arithmetic were all
 * asserted here against a fabricated `now`; they are now SQL, and `apps/api/test/access.e2e-spec.ts`
 * asserts them against a real database — including the case this file could not reach at all, that
 * ordering spans the union rather than running per collection.
 *
 * What is left is what this tier still decides: **the URL**, which is UX-4's addressable state and
 * belongs to the screen, and **FR-60's mirror**, which exists so the screen does not offer a control
 * the API will refuse.
 */
/**
 * **`Partial<MemberRow>` and no trailing cast, since task 140's gate review.** It read
 * `(over: Partial<AccessRow>) => ({ … } as AccessRow)`, and the cast is what let a **required**
 * field be added to `MemberRow` with this fixture compiling unchanged — `displayName` was missing
 * here and nothing said so, where the same omission in `access-board.spec.tsx` was a type error the
 * compiler raised immediately. A cast over an object literal turns the compiler off for exactly the
 * check a fixture exists to receive.
 *
 * `Partial<MemberRow>` rather than `Partial<AccessRow>` for the same reason: over the union, an
 * override naming an invitation's field would be accepted for a row whose `kind` is `member`.
 */
const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  kind: ACCESS_ROW_KIND.MEMBER,
  id: 'm-1',
  email: 'ana@example.md',
  displayName: 'Ana Popescu',
  role: MEMBERSHIP_ROLE.EDITOR,
  standing: ACCESS_STANDING.ACTIVE,
  emailSuppressed: false,
  accountId: 'acc-1',
  lastActiveAt: null,
  joinedAt: 0,
  ...over,
});

const view = (over: Partial<typeof DEFAULT_ACCESS_VIEW> = {}) => ({
  ...DEFAULT_ACCESS_VIEW,
  ...over,
});

describe('access · row identity', () => {
  /**
   * The two halves come from different tables, so an id alone is unique only within its own — and
   * qualifying it is what lets one key serve the table's `rowKey`, the per-row pending state and any
   * later selection without three functions that must agree.
   */
  it('qualifies an id with its kind, so the two collections cannot collide', () => {
    const asMember = accessRowKey(member({ id: 'shared' }));
    const asInvitation = accessRowKey({
      kind: ACCESS_ROW_KIND.INVITATION,
      id: 'shared',
      email: 'b@example.md',
      role: MEMBERSHIP_ROLE.VIEWER,
      standing: ACCESS_STANDING.INVITED,
      emailSuppressed: false,
      issuedAt: 0,
      expiresAt: 1,
    });

    expect(asMember).not.toBe(asInvitation);
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

/**
 * The other direction: the same view, as the API's compact list query (§6.8).
 *
 * Two different encodings of one state, which is exactly the pair worth testing together — the URL
 * is the reader's and the compact query is the wire's, and nothing but these functions keeps them
 * describing the same list.
 */
describe('access · the API query', () => {
  it('sends no facet for a filter that is unset', () => {
    // `ACCESS_FILTER_ANY` is this screen's spelling of "no filter" **in a URL**, where UX-4 needs
    // even the unset state to be addressable. On the wire an unset facet is an absent one; sending
    // `any` would make it a value the server has to know about.
    expect(accessListQuery(DEFAULT_ACCESS_VIEW).filters).toEqual([]);
  });

  it('sends each facet it has, by the field name the API defines', () => {
    expect(
      accessListQuery(
        view({ role: MEMBERSHIP_ROLE.VIEWER, standing: ACCESS_STANDING.INVITATION_EXPIRED }),
      ).filters,
    ).toEqual([
      { field: 'role', values: [MEMBERSHIP_ROLE.VIEWER] },
      { field: 'standing', values: [ACCESS_STANDING.INVITATION_EXPIRED] },
    ]);
  });

  it('always sends the ordering and the window, because the API defaults are not this screen’s', () => {
    // The API's own default is `activity,desc` and happens to match, but the screen states its
    // order rather than relying on that: the two defaults live in different repositories' heads,
    // and a list that silently reordered when the server changed its mind would be very hard to see.
    const query = accessListQuery(view({ sort: ACCESS_SORT.PERSON, direction: ACCESS_SORT_DIRECTION.ASCENDING, page: 4 }));

    expect(query.order).toEqual([{ field: ACCESS_SORT.PERSON, direction: ACCESS_SORT_DIRECTION.ASCENDING }]);
    expect(query.page).toBe(4);
    expect(query.onpage).toBe(ACCESS_PAGE_SIZE);
  });
});

/**
 * FR-60 seen from the screen — and **the count is the organization's, not the page's** (task 131).
 *
 * It counted administrators among the rows it was handed, which was every row while this tier held
 * the whole list. Under server-side paging those rows are one page, so an organization whose only
 * administrator sits on page 2 would have been offered a demotion on page 1 that the API refuses.
 * `readOrganizationAccess` asks for the count directly.
 */
describe('access · FR-60 seen from the screen', () => {
  const administrator = member({ role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR });

  it('locks the sole administrator', () => {
    expect(isLastAdministrator({ administrators: 1, row: administrator })).toBe(true);
  });

  it('leaves everyone else alone, whatever the count', () => {
    expect(isLastAdministrator({ administrators: 1, row: member() })).toBe(false);
  });

  it('unlocks once a second administrator exists', () => {
    expect(isLastAdministrator({ administrators: 2, row: administrator })).toBe(false);
  });

  /**
   * An invitation at administrator level cannot exist (FR-57 admits edit and view-only only), but
   * the predicate checks the kind explicitly rather than relying on that — the rule it mirrors is
   * about who can administer the organization **now**, and someone who has not accepted cannot.
   */
  it('does not treat an unaccepted invitation as an administrator', () => {
    const invited: AccessRow = {
      kind: ACCESS_ROW_KIND.INVITATION,
      id: 'i-1',
      email: 'pending@example.md',
      role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      standing: ACCESS_STANDING.INVITED,
      emailSuppressed: false,
      issuedAt: 0,
      expiresAt: 1,
    };

    expect(isLastAdministrator({ administrators: 1, row: invited })).toBe(false);
  });
});

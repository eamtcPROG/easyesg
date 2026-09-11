import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { ACCESS_FILTER_ANY, ACCESS_SORT, ACCESS_STANDING } from '../models/access.model';
import { DEFAULT_ACCESS_SORT, toAccessQuery, type ListQueryInput } from './access-query';

/**
 * §6.8's compact query, narrowed to what S-16 can be asked (task 131).
 *
 * **Every case here is about what happens to input nobody validated.** The compact format is parsed
 * by an interceptor shared across three projects, so what reaches this function is whatever survived
 * a URL — and the rule is that a stale or hand-edited query string shows the list rather than a
 * screen about the query string. A test suite that only fed it valid input would assert nothing this
 * function exists for.
 */
const PAGE_SIZE = 25;

const input = (over: Partial<ListQueryInput> = {}): ListQueryInput => ({
  filters: [],
  order: [],
  skip: 0,
  take: PAGE_SIZE,
  ...over,
});

describe('toAccessQuery', () => {
  it('defaults to recency first — who is here now', () => {
    expect(toAccessQuery(input(), PAGE_SIZE)).toStrictEqual({
      role: ACCESS_FILTER_ANY,
      standing: ACCESS_FILTER_ANY,
      sort: DEFAULT_ACCESS_SORT,
      descending: true,
      skip: 0,
      take: PAGE_SIZE,
    });
    expect(DEFAULT_ACCESS_SORT).toBe(ACCESS_SORT.ACTIVITY);
  });

  it('takes both facets when they name members of their vocabularies', () => {
    const query = toAccessQuery(
      input({
        filters: [
          { field: 'role', values: [MEMBERSHIP_ROLE.EDITOR] },
          { field: 'standing', values: [ACCESS_STANDING.INVITED] },
        ],
      }),
      PAGE_SIZE,
    );

    expect(query.role).toBe(MEMBERSHIP_ROLE.EDITOR);
    expect(query.standing).toBe(ACCESS_STANDING.INVITED);
  });

  it.each([
    ['a role that is not one', [{ field: 'role', values: ['owner'] }]],
    ['a standing that is not one', [{ field: 'standing', values: ['pending'] }]],
    ['a field this route does not define', [{ field: 'seat', values: ['free'] }]],
    ['a facet with no value at all', [{ field: 'role', values: [] }]],
  ])('ignores %s rather than refusing the request', (_name, filters) => {
    const query = toAccessQuery(input({ filters }), PAGE_SIZE);

    // Unset, not "matches nothing": a stale query string shows the list. Both facets are asserted,
    // because the failure worth catching is one unreadable facet quietly clearing the other.
    expect(query.role).toBe(ACCESS_FILTER_ANY);
    expect(query.standing).toBe(ACCESS_FILTER_ANY);
  });

  it('honours an ordering, in both directions', () => {
    expect(
      toAccessQuery(input({ order: [{ field: ACCESS_SORT.PERSON, direction: 'asc' }] }), PAGE_SIZE),
    ).toMatchObject({ sort: ACCESS_SORT.PERSON, descending: false });

    expect(
      toAccessQuery(input({ order: [{ field: ACCESS_SORT.ROLE, direction: 'desc' }] }), PAGE_SIZE),
    ).toMatchObject({ sort: ACCESS_SORT.ROLE, descending: true });
  });

  it('falls back to the default ordering, direction included, when the field is not sortable', () => {
    // The direction must fall back **with** the field. Keeping `asc` from an unreadable ordering
    // would silently invert the default list, which is the one wrong answer that still looks right.
    expect(
      toAccessQuery(input({ order: [{ field: 'seat', direction: 'asc' }] }), PAGE_SIZE),
    ).toMatchObject({ sort: DEFAULT_ACCESS_SORT, descending: true });
  });

  it('honours only the first ordering, because the screen has one', () => {
    expect(
      toAccessQuery(
        input({
          order: [
            { field: ACCESS_SORT.PERSON, direction: 'asc' },
            { field: ACCESS_SORT.ROLE, direction: 'desc' },
          ],
        }),
        PAGE_SIZE,
      ),
    ).toMatchObject({ sort: ACCESS_SORT.PERSON, descending: false });
  });

  it('clamps a negative offset and refuses "all rows"', () => {
    expect(toAccessQuery(input({ skip: -50 }), PAGE_SIZE).skip).toBe(0);
    // An absent window becomes one page rather than everything. This is not the `onpage=-1` path —
    // the interceptor refuses that with a 400 before the handler, which `access.e2e-spec.ts`
    // asserts. What this covers is the type and the controller's fallback for a missing
    // interceptor, where "unbounded" would be the silent wrong answer.
    expect(toAccessQuery(input({ take: undefined }), PAGE_SIZE).take).toBe(PAGE_SIZE);
  });
});

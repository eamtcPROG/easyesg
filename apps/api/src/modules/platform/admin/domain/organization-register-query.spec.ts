import {
  REGISTER_SEARCH_MAX_LENGTH,
  toOrganizationRegisterQuery,
} from './organization-register-query';

/**
 * A-02's query narrowing (task 67.3). Literals on purpose where they are the wire: `name`, `asc` and
 * `desc` are what the console writes into its URL, and a renamed value must fail here.
 */
const list = (overrides: Partial<Parameters<typeof toOrganizationRegisterQuery>[0]['list']> = {}) => ({
  order: [],
  skip: 0,
  take: 50,
  ...overrides,
});

const narrow = (input: { list?: ReturnType<typeof list>; search?: unknown } = {}) =>
  toOrganizationRegisterQuery({ list: input.list ?? list(), search: input.search, fallbackTake: 25 });

describe('toOrganizationRegisterQuery (A-02, task 67.3)', () => {
  it('defaults to name ascending with no search', () => {
    expect(narrow()).toEqual({ search: null, sort: 'name', descending: false, skip: 0, take: 50 });
  });

  it('honours the first readable ordering and its direction', () => {
    expect(
      narrow({ list: list({ order: [{ field: 'activity', direction: 'desc' }, { field: 'name', direction: 'asc' }] }) }),
    ).toMatchObject({ sort: 'activity', descending: true });
  });

  it('falls back to the default rather than refusing an ordering it does not offer', () => {
    // `plan` is FR-76's deferred field, and `idno` is searchable but not an ordering.
    for (const field of ['plan', 'idno', '']) {
      expect(narrow({ list: list({ order: [{ field, direction: 'desc' }] }) })).toMatchObject({
        sort: 'name',
        descending: false,
      });
    }
  });

  it('trims a search, cuts it to its bound, and reads nothing left as no search', () => {
    expect(narrow({ search: '  Lina SRL, Chișinău  ' }).search).toBe('Lina SRL, Chișinău');
    expect(narrow({ search: 'x'.repeat(REGISTER_SEARCH_MAX_LENGTH + 40) }).search).toHaveLength(
      REGISTER_SEARCH_MAX_LENGTH,
    );
    expect(narrow({ search: '   ' }).search).toBeNull();
  });

  it('reads a repeated or missing search parameter as no search', () => {
    expect(narrow({ search: ['a', 'b'] }).search).toBeNull();
    expect(narrow({ search: undefined }).search).toBeNull();
  });

  it('never lets a negative offset through, and falls back to its own page size', () => {
    expect(narrow({ list: list({ skip: -50, take: undefined }) })).toMatchObject({ skip: 0, take: 25 });
  });
});

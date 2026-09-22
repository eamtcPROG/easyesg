import type { ListQueryInput } from '@api/contracts/types/list-query';
import { toNotificationCentreQuery } from './notification-centre-query';

/**
 * The centre's list query, narrowed (task 50.1.2). Literals on purpose: they are what a URL carries, and a rename of
 * a facet's wire value must fail here.
 */
describe('toNotificationCentreQuery (task 50.1.2)', () => {
  const list = (over: Partial<ListQueryInput> = {}): ListQueryInput => ({
    filters: [],
    order: [],
    skip: 0,
    take: 25,
    ...over,
  });
  const narrow = (over: Partial<ListQueryInput> = {}) =>
    toNotificationCentreQuery({ list: list(over), fallbackTake: 25 });

  it('asks for everything, newest first, when nothing is given', () => {
    expect(narrow()).toEqual({ readState: null, categories: [], newestFirst: true, skip: 0, take: 25 });
  });

  it.each(['unread', 'read'])('narrows to the %s read state', (value) => {
    expect(narrow({ filters: [{ field: 'read', values: [value] }] }).readState).toBe(value);
  });

  it('treats a read state outside the vocabulary as both, rather than refusing', () => {
    expect(narrow({ filters: [{ field: 'read', values: ['seen'] }] }).readState).toBeNull();
  });

  it('takes several categories, once each, and drops one nobody declared', () => {
    expect(
      narrow({
        filters: [
          { field: 'category', values: ['identity.invitation', 'billing.nothing', 'identity.invitation'] },
        ],
      }).categories,
    ).toEqual(['identity.invitation']);
  });

  it('ignores a facet field the centre does not define', () => {
    expect(narrow({ filters: [{ field: 'role', values: ['editor'] }] })).toEqual(narrow());
  });

  it('orders oldest first on request, and newest first otherwise', () => {
    expect(narrow({ order: [{ field: 'received', direction: 'asc' }] }).newestFirst).toBe(false);
    expect(narrow({ order: [{ field: 'received', direction: 'desc' }] }).newestFirst).toBe(true);
    expect(narrow({ order: [{ field: 'category', direction: 'asc' }] }).newestFirst).toBe(true);
  });

  it('carries the window, and serves one page when no size arrived', () => {
    expect(narrow({ skip: 50, take: 10 })).toMatchObject({ skip: 50, take: 10 });
    expect(narrow({ skip: -5, take: undefined })).toMatchObject({ skip: 0, take: 25 });
  });
});

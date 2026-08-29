import { MEMBERSHIP_ROLE, type AccountMembership } from '../models/membership.model';
import type { AccountMembershipStore } from '../interfaces/account-membership-store.interface';
import { ListOwnMemberships } from './list-own-memberships.use-case';

/**
 * The `active` marker's three states (task 30.1), as a unit spec rather than as a browser journey.
 *
 * Two of the three are only reachable over HTTP by contriving a session — an account with several
 * memberships and no stated preference, and one whose preference names an organization it has been
 * removed from — which is exactly why `selectActiveMembership` was extracted as a pure function in
 * task 25.3 and why the projection over it belongs here.
 */
const membership = (organizationId: string, organizationName: string): AccountMembership => ({
  membershipId: `membership-${organizationId}`,
  organizationId,
  organizationName,
  role: MEMBERSHIP_ROLE.EDITOR,
  joinedAt: new Date('2026-08-01T00:00:00.000Z'),
});

const ALPHA = membership('org-a', 'Alpha SRL');
const BETA = membership('org-b', 'Beta SRL');

const storeReturning = (memberships: AccountMembership[]): AccountMembershipStore => ({
  listForAccount: () => Promise.resolve(memberships),
});

describe('ListOwnMemberships (FR-12, UC-16 view half)', () => {
  it('marks the organization the request resolved to, and only that one', async () => {
    const result = await new ListOwnMemberships(storeReturning([ALPHA, BETA])).execute({
      accountId: 'account-1',
      activeOrganizationId: 'org-b',
    });

    expect(result.map((entry) => [entry.organizationId, entry.active])).toEqual([
      ['org-a', false],
      ['org-b', true],
    ]);
  });

  // The state the switcher exists to resolve: UX-2 makes the choice deliberate, so
  // `selectActiveMembership` answers null and the honest projection marks nothing.
  it('marks nothing when several memberships are held and none is active', async () => {
    const result = await new ListOwnMemberships(storeReturning([ALPHA, BETA])).execute({
      accountId: 'account-1',
      activeOrganizationId: null,
    });

    expect(result.every((entry) => !entry.active)).toBe(true);
  });

  // Reachable through FR-59: the session still names an organization the account was removed from.
  // The guard degrades that to "no preference" rather than to the first membership, so no row here
  // may be promoted either — landing someone in a DIFFERENT tenant is the failure being avoided.
  it('marks nothing when the resolved organization is not among the memberships', async () => {
    const result = await new ListOwnMemberships(storeReturning([ALPHA, BETA])).execute({
      accountId: 'account-1',
      activeOrganizationId: 'org-gone',
    });

    expect(result.every((entry) => !entry.active)).toBe(true);
  });

  it('carries the store’s order and every field through untouched', async () => {
    const [entry] = await new ListOwnMemberships(storeReturning([ALPHA])).execute({
      accountId: 'account-1',
      activeOrganizationId: 'org-a',
    });

    expect(entry).toEqual({ ...ALPHA, active: true });
  });

  it('answers an empty list for an account belonging to nothing', async () => {
    await expect(
      new ListOwnMemberships(storeReturning([])).execute({
        accountId: 'account-1',
        activeOrganizationId: null,
      }),
    ).resolves.toEqual([]);
  });
});

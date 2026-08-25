import { RemoveMember } from './remove-member.use-case';
import { LastAdministratorError, MemberNotFoundError } from '../errors/membership.errors';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '../models/membership.model';
import { FakeMembershipStore, membership } from '../testing/membership-store.fake';

const { ORGANIZATION_ADMINISTRATOR, EDITOR } = MEMBERSHIP_ROLE;
const NOW = new Date('2026-08-25T09:00:00Z');

const removeMember = (store: FakeMembershipStore) => new RemoveMember(store, () => NOW);

describe('RemoveMember (UC-63)', () => {
  it('withdraws access without deleting the row (FR-59, FR-55)', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);

    await removeMember(store).execute({ membershipId: 'm1' });

    // The row survives, which is the requirement. A spec asserting only "the list no longer shows
    // them" would pass identically against a delete, and would therefore prove the wrong thing.
    expect(store.all).toHaveLength(2);
    expect(store.all[1]).toMatchObject({ status: MEMBERSHIP_STATUS.REMOVED, removedAt: NOW });
    expect(await store.listActiveMembers()).toHaveLength(1);
  });

  it('refuses to remove the last administrator (FR-60)', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);

    await expect(removeMember(store).execute({ membershipId: 'oa' })).rejects.toBeInstanceOf(
      LastAdministratorError,
    );
    expect(store.all[0].status).toBe(MEMBERSHIP_STATUS.ACTIVE);
  });

  it('removes an administrator once a second one exists', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'oa2', role: ORGANIZATION_ADMINISTRATOR }),
    ]);

    await removeMember(store).execute({ membershipId: 'oa' });

    expect(await store.countActiveAdministrators()).toBe(1);
  });

  /**
   * The count is read from the state as it stands at the moment of the change, not from the state
   * the request started in. Removing the second administrator must refuse even though there were
   * two when the first call began.
   */
  it('refuses the second removal in a sequence that would empty the organization', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'oa2', role: ORGANIZATION_ADMINISTRATOR }),
    ]);
    const useCase = removeMember(store);

    await useCase.execute({ membershipId: 'oa' });

    await expect(useCase.execute({ membershipId: 'oa2' })).rejects.toBeInstanceOf(
      LastAdministratorError,
    );
  });

  it('refuses an unknown membership', async () => {
    const store = new FakeMembershipStore([]);

    await expect(removeMember(store).execute({ membershipId: 'nope' })).rejects.toBeInstanceOf(
      MemberNotFoundError,
    );
  });

  // A stale S-16 acting twice. 404 is what tells the front end to refresh, where a cheerful 204
  // would report success for something it did not do.
  it('refuses a member already removed', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'm1', role: EDITOR, status: MEMBERSHIP_STATUS.REMOVED }),
    ]);

    await expect(removeMember(store).execute({ membershipId: 'm1' })).rejects.toBeInstanceOf(
      MemberNotFoundError,
    );
  });
});

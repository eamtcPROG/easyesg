import { ChangeMemberRole } from './change-member-role.use-case';
import { LastAdministratorError, MemberNotFoundError } from '../errors/membership.errors';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '../models/membership.model';
import { FakeMembershipStore, membership } from '../testing/membership-store.fake';

const { ORGANIZATION_ADMINISTRATOR, EDITOR, VIEWER } = MEMBERSHIP_ROLE;
const NOW = new Date('2026-08-25T09:00:00Z');

const changeRole = (store: FakeMembershipStore) => new ChangeMemberRole(store, () => NOW);

describe('ChangeMemberRole (UC-62, UC-64)', () => {
  it('moves a member between edit and view-only', async () => {
    const store = new FakeMembershipStore([membership({ id: 'm1', role: EDITOR })]);

    await changeRole(store).execute({ membershipId: 'm1', role: VIEWER });

    expect(store.all[0].role).toBe(VIEWER);
  });

  // UC-64: the promotion path, which exists so that UC-63 has a way to become permissible.
  it('promotes a member to Organization Administrator', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);

    await changeRole(store).execute({ membershipId: 'm1', role: ORGANIZATION_ADMINISTRATOR });

    expect(await store.countActiveAdministrators()).toBe(2);
  });

  it('refuses to demote the last administrator (FR-60)', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);

    await expect(
      changeRole(store).execute({ membershipId: 'oa', role: EDITOR }),
    ).rejects.toBeInstanceOf(LastAdministratorError);
    expect(store.all[0].role).toBe(ORGANIZATION_ADMINISTRATOR);
  });

  /**
   * The sequence FR-60 exists to make possible, asserted as a sequence: the refusal is not a
   * permanent property of an administrator, it is a property of being the only one.
   */
  it('permits the demotion once someone else has been promoted first', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);
    const useCase = changeRole(store);

    await useCase.execute({ membershipId: 'm1', role: ORGANIZATION_ADMINISTRATOR });
    await useCase.execute({ membershipId: 'oa', role: EDITOR });

    expect(store.all.map((row) => row.role)).toEqual([EDITOR, ORGANIZATION_ADMINISTRATOR]);
  });

  it('refuses an unknown membership', async () => {
    const store = new FakeMembershipStore([]);

    await expect(
      changeRole(store).execute({ membershipId: 'nope', role: EDITOR }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  // A removed member is not a member. Re-granting access is an invitation (UC-15), not an edit.
  it('refuses a removed membership rather than silently reviving it', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'm1', role: EDITOR, status: MEMBERSHIP_STATUS.REMOVED }),
    ]);

    await expect(
      changeRole(store).execute({ membershipId: 'm1', role: VIEWER }),
    ).rejects.toBeInstanceOf(MemberNotFoundError);
    expect(store.all[0].status).toBe(MEMBERSHIP_STATUS.REMOVED);
  });

  it('permits setting the role a member already holds', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
    ]);

    await expect(
      changeRole(store).execute({ membershipId: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
    ).resolves.toBeUndefined();
  });

  /**
   * Literals on purpose, and the only place in this suite that uses them. CLAUDE.md's second
   * closed-vocabulary exception: a spec written entirely in constants cannot fail when someone
   * renames a value, and these three are frozen into `membership_role_known` in a migration and
   * into whatever `@easyesg/contracts` has already generated for both front ends.
   */
  it('pins the wire values the CHECK constraint and the contract both carry', () => {
    expect(Object.values(MEMBERSHIP_ROLE)).toEqual([
      'editor',
      'viewer',
      'organization_administrator',
    ]);
  });
});

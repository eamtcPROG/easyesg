import { ListMembers } from './list-members.use-case';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '../models/membership.model';
import { FakeMembershipStore, membership } from '../testing/membership-store.fake';

const { ORGANIZATION_ADMINISTRATOR, EDITOR } = MEMBERSHIP_ROLE;

describe('ListMembers (UC-59)', () => {
  it('answers who can see the organization’s data, with each role', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'm1', role: EDITOR }),
    ]);

    const members = await new ListMembers(store).execute();

    expect(members.map((m) => [m.membershipId, m.role])).toEqual([
      ['oa', ORGANIZATION_ADMINISTRATOR],
      ['m1', EDITOR],
    ]);
  });

  it('omits removed members — the list is access, not history (FR-56)', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
      membership({ id: 'gone', role: EDITOR, status: MEMBERSHIP_STATUS.REMOVED }),
    ]);

    const members = await new ListMembers(store).execute();

    expect(members.map((m) => m.membershipId)).toEqual(['oa']);
  });

  // The honest gap, asserted so it is a decision rather than a bug someone finds on S-16. Nothing
  // writes `last_active_at` until task 28's guard resolves a request against the membership row.
  it('reports last activity as absent rather than inventing it', async () => {
    const store = new FakeMembershipStore([
      membership({ id: 'oa', role: ORGANIZATION_ADMINISTRATOR }),
    ]);

    const [member] = await new ListMembers(store).execute();

    expect(member.lastActiveAt).toBeNull();
    expect(member.joinedAt).not.toBeNull();
  });
});

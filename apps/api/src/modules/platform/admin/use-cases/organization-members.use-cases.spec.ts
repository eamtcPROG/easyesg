import { MemberPhoneNotFoundError, OrganizationNotRegisteredError } from '../errors/organization-register.errors';
import type {
  MemberPhoneRead,
  OrganizationMembersRead,
  OrganizationMembersStore,
} from '../interfaces/organization-members-store.interface';
import type { OrganizationMember } from '../models/organization-member.model';
import { DiscloseMemberPhone } from './disclose-member-phone.use-case';
import { ListOrganizationMembers } from './list-organization-members.use-case';

const ORGANIZATION = '0b8a1f3e-0000-4000-8000-000000000001';
const OPERATOR = '0b8a1f3e-0000-4000-8000-0000000000aa';
const ANA = '0b8a1f3e-0000-4000-8000-0000000000b1';

const MEMBER: OrganizationMember = {
  accountId: ANA,
  displayName: 'Ana Popescu',
  email: 'ana@lina.md',
  role: 'organization_administrator',
  hasPhone: true,
};

/** A store answering what the case gives it, and recording what it was asked — the requester above all. */
class FakeMembersStore implements OrganizationMembersStore {
  readonly asked: (OrganizationMembersRead | MemberPhoneRead)[] = [];
  constructor(private readonly answers: { members?: readonly OrganizationMember[] | null; phone?: string | null }) {}

  members(read: OrganizationMembersRead) {
    this.asked.push(read);
    return Promise.resolve(this.answers.members ?? null);
  }

  phone(read: MemberPhoneRead) {
    this.asked.push(read);
    return Promise.resolve(this.answers.phone ?? null);
  }
}

/** Task 167: A-02's record's people, and one member's phone at a time. */
describe('ListOrganizationMembers', () => {
  it('answers the organization’s members, asking as the operator reading', async () => {
    const store = new FakeMembersStore({ members: [MEMBER] });
    await expect(
      new ListOrganizationMembers(store).execute({ organizationId: ORGANIZATION, requesterId: OPERATOR }),
    ).resolves.toEqual([MEMBER]);
    expect(store.asked).toEqual([{ organizationId: ORGANIZATION, requesterId: OPERATOR }]);
  });

  it('answers an organization with nobody in it with nobody', async () => {
    const store = new FakeMembersStore({ members: [] });
    await expect(
      new ListOrganizationMembers(store).execute({ organizationId: ORGANIZATION, requesterId: OPERATOR }),
    ).resolves.toEqual([]);
  });

  it('refuses an organization the register does not hold', async () => {
    const store = new FakeMembersStore({ members: null });
    await expect(
      new ListOrganizationMembers(store).execute({ organizationId: ORGANIZATION, requesterId: OPERATOR }),
    ).rejects.toBeInstanceOf(OrganizationNotRegisteredError);
  });
});

describe('DiscloseMemberPhone', () => {
  it('answers the one member’s phone, asking as the operator reading', async () => {
    const store = new FakeMembersStore({ phone: '+37369123456' });
    await expect(
      new DiscloseMemberPhone(store).execute({ organizationId: ORGANIZATION, accountId: ANA, requesterId: OPERATOR }),
    ).resolves.toEqual({ phone: '+37369123456' });
    expect(store.asked).toEqual([{ organizationId: ORGANIZATION, accountId: ANA, requesterId: OPERATOR }]);
  });

  it('refuses when the account is no active member or gave no phone, so nothing is recorded as disclosed', async () => {
    const store = new FakeMembersStore({ phone: null });
    await expect(
      new DiscloseMemberPhone(store).execute({ organizationId: ORGANIZATION, accountId: ANA, requesterId: OPERATOR }),
    ).rejects.toBeInstanceOf(MemberPhoneNotFoundError);
  });
});

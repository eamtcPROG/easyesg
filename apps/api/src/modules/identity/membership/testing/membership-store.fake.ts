import type { MembershipStore } from '../interfaces/membership-store.interface';
import {
  MEMBERSHIP_ROLE,
  MEMBERSHIP_STATUS,
  type Membership,
  type MembershipRole,
  type OrganizationMember,
} from '../models/membership.model';

/**
 * An in-memory `MembershipStore` for the use-case specs — no database, no container (CLAUDE.md's
 * check that the dependencies point inward).
 *
 * **It models one organization, because RLS does.** The real store takes no organization id
 * anywhere, so a fake holding rows for several tenants would be modelling a filter the production
 * code does not have — and a spec passing against it would prove something untrue. Cross-tenant
 * behaviour is asserted where it is actually enforced, in `tenant-isolation.e2e-spec.ts`.
 *
 * It writes rather than merely recording calls: `changeRole` and `removeMember` mutate the rows
 * `findMembership` and `countActiveAdministrators` read, so a spec can assert the order-dependent
 * thing that matters — that the lockout count is taken from the state as it stands at the moment
 * of the change.
 */
export class FakeMembershipStore implements MembershipStore {
  constructor(private rows: Membership[] = []) {}

  get all(): readonly Membership[] {
    return this.rows;
  }

  listActiveMembers(): Promise<OrganizationMember[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.status === MEMBERSHIP_STATUS.ACTIVE)
        .map((row) => ({
          membershipId: row.id,
          accountId: row.accountId,
          email: `${row.accountId}@example.md`,
          role: row.role,
          status: row.status,
          lastActiveAt: row.lastActiveAt,
          joinedAt: row.createdAt,
        })),
    );
  }

  findMembership(membershipId: string): Promise<Membership | null> {
    return Promise.resolve(this.rows.find((row) => row.id === membershipId) ?? null);
  }

  countActiveAdministrators(): Promise<number> {
    return Promise.resolve(
      this.rows.filter(
        (row) =>
          row.status === MEMBERSHIP_STATUS.ACTIVE &&
          row.role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      ).length,
    );
  }

  changeRole(membershipId: string, role: MembershipRole): Promise<boolean> {
    return Promise.resolve(this.write(membershipId, (row) => ({ ...row, role })));
  }

  removeMember(membershipId: string, at: Date): Promise<boolean> {
    return Promise.resolve(
      this.write(membershipId, (row) => ({
        ...row,
        status: MEMBERSHIP_STATUS.REMOVED,
        removedAt: at,
      })),
    );
  }

  private write(membershipId: string, change: (row: Membership) => Membership): boolean {
    const index = this.rows.findIndex((row) => row.id === membershipId);
    if (index === -1) return false;
    this.rows = this.rows.map((row, at) => (at === index ? change(row) : row));
    return true;
  }
}

/** A row with the fields a spec cares about named and the rest defaulted. */
export const membership = (row: {
  id: string;
  role: MembershipRole;
  status?: Membership['status'];
  accountId?: string;
}): Membership => ({
  id: row.id,
  accountId: row.accountId ?? `account-${row.id}`,
  organizationId: 'organization-under-test',
  role: row.role,
  status: row.status ?? MEMBERSHIP_STATUS.ACTIVE,
  removedAt: row.status === MEMBERSHIP_STATUS.REMOVED ? new Date('2026-08-01T00:00:00Z') : null,
  lastActiveAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
});

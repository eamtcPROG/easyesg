import { Injectable } from '@nestjs/common';
import type {
  MembershipStore,
} from '@api/modules/identity/membership/interfaces/membership-store.interface';
import {
  MEMBERSHIP_ROLE,
  MEMBERSHIP_STATUS,
  type Membership,
  type MembershipRole,
  type MembershipStatus,
  type OrganizationMember,
} from '@api/modules/identity/membership/models/membership.model';
import { TenantRepository } from '../tenant-repository';

/** Rows as PostgreSQL returns them: snake_case, `timestamptz` already parsed to `Date` by `pg`. */
interface MembershipRow {
  id: string;
  account_id: string;
  organization_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  removed_at: Date | null;
  last_active_at: Date | null;
  created_at: Date;
}

interface MemberRow extends MembershipRow {
  email: string;
}

/**
 * The `MembershipStore` adapter — and the first repository in this codebase that actually **extends
 * `TenantRepository`** rather than being one of the exemptions its header lists.
 *
 * `AccountStoreRepository` opens its own transaction because registration precedes any tenant.
 * This one does the opposite and must: `manager` resolves the request's `QueryRunner` from
 * `AsyncLocalStorage` and **throws** when there is none. That throw is the entire T-11 mitigation
 * here, because the alternative is not an error — RLS returns zero rows for an unbound context, so
 * a query that missed the request transaction would report that the organization has no members.
 * On this table of all tables, that is a wrong answer a reader would believe.
 *
 * **No statement below names an organization**, and none may. `app.current_org` is bound to the
 * transaction and the policies do the scoping; a `WHERE organization_id = $1` here would read as
 * prudence and would in fact be a second source of tenancy, drifting from the policy the moment
 * either changed. The one place that is asserted is `tenant-isolation.e2e-spec.ts`, which issues
 * exactly these queries with no `WHERE` clause and proves they cannot cross.
 *
 * Every statement is schema-qualified, as the baseline requires: TypeORM's postgres driver sets no
 * `search_path`.
 *
 * Rows are typed with a **type argument** rather than the `as Row[]` assertion the identity
 * repositories next door use, and the difference is not style: `EntityManager.query` is generic and
 * unoverloaded, while `QueryRunner.query` carries a `useStructuredResult` overload that a type
 * argument resolves to the wrong signature (TS2558). Same call, two spellings, each forced.
 */
@Injectable()
export class MembershipStoreRepository extends TenantRepository<never> implements MembershipStore {
  protected readonly entity = 'identity.membership' as never;

  /**
   * The join is to `identity.account`, which carries no RLS of its own — an account exists before
   * any organization does. It is safe precisely because the driving side is scoped: the policy
   * decides which memberships are visible, and the join can only reach the accounts those name.
   */
  async listActiveMembers(): Promise<OrganizationMember[]> {
    const rows = await this.manager.query<MemberRow[]>(
      `SELECT m.id, m.account_id, m.organization_id, m.role, m.status,
              m.removed_at, m.last_active_at, m.created_at, a.email
         FROM identity.membership m
         JOIN identity.account a ON a.id = m.account_id
        WHERE m.status = $1
        ORDER BY m.created_at, m.id`,
      [MEMBERSHIP_STATUS.ACTIVE],
    );

    return rows.map((row) => ({
      membershipId: row.id,
      accountId: row.account_id,
      email: row.email,
      role: row.role,
      status: row.status,
      lastActiveAt: row.last_active_at,
      joinedAt: row.created_at,
    }));
  }

  async findMembership(membershipId: string): Promise<Membership | null> {
    const rows = await this.manager.query<MembershipRow[]>(
      `SELECT id, account_id, organization_id, role, status, removed_at, last_active_at, created_at
         FROM identity.membership WHERE id = $1`,
      [membershipId],
    );

    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      accountId: row.account_id,
      organizationId: row.organization_id,
      role: row.role,
      status: row.status,
      removedAt: row.removed_at,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
    };
  }

  async countActiveAdministrators(): Promise<number> {
    const rows = await this.manager.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM identity.membership WHERE status = $1 AND role = $2`,
      [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
    );
    return rows[0].count;
  }

  /**
   * `updated_at` is set explicitly rather than by a trigger, per task 14's note: the central
   * mutation path maintains it, and a trigger here would be a second writer of one column. The
   * capture trigger ignores it, so it costs no audit row.
   */
  async changeRole(membershipId: string, role: MembershipRole, at: Date): Promise<boolean> {
    return this.wroteOneRow(
      `UPDATE identity.membership SET role = $2, updated_at = $3
        WHERE id = $1 AND status = $4 RETURNING id`,
      [membershipId, role, at, MEMBERSHIP_STATUS.ACTIVE],
    );
  }

  /**
   * The soft delete FR-59 requires — and there is no hard one available to write by mistake:
   * `esg_app` holds no `DELETE` on this table (task 25.1), so a later author reaching for one gets
   * a privilege error rather than a silently destroyed audit trail.
   */
  async removeMember(membershipId: string, at: Date): Promise<boolean> {
    return this.wroteOneRow(
      `UPDATE identity.membership SET status = $2, removed_at = $3, updated_at = $3
        WHERE id = $1 AND status = $4 RETURNING id`,
      [membershipId, MEMBERSHIP_STATUS.REMOVED, at, MEMBERSHIP_STATUS.ACTIVE],
    );
  }

  /**
   * `UPDATE ... RETURNING` gives back `[rows, rowCount]`, not the bare row array a `SELECT` or an
   * `INSERT ... RETURNING` gives — TypeORM builds `raw` with a switch on the driver's `command`.
   * Normalising here rather than at each call site is the api CLAUDE.md's standing advice, and the
   * reason it is standing advice is that the mistake surfaces later as a `TypeError` on a property
   * of what should have been a row.
   */
  private async wroteOneRow(sql: string, parameters: unknown[]): Promise<boolean> {
    const result: unknown = await this.manager.query(sql, parameters);
    const [rows] = result as [unknown[], number];
    return rows.length === 1;
  }
}

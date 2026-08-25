import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  AccountMembershipStore,
} from '@api/modules/identity/membership/interfaces/account-membership-store.interface';
import {
  MEMBERSHIP_STATUS,
  type AccountMembership,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';
import { CORE_DATA_SOURCE } from '../data-source';

interface AccountMembershipRow {
  id: string;
  organization_id: string;
  organization_name: string;
  role: MembershipRole;
  created_at: Date;
}

/**
 * The `AccountMembershipStore` adapter, and the counterpart to `MembershipStoreRepository` in every
 * respect that matters.
 *
 * That one extends `TenantRepository` and borrows the request's transaction. This one **must not**:
 * it is read before a tenant exists, so there is no request transaction to borrow — and borrowing
 * one would be worse than failing, because `organization_directory_select`'s first conjunct is
 * `app.current_org IS NULL`, so a bound transaction would return the memberships with the
 * organization names silently missing. It opens its own, like `AccountStoreRepository`, and binds
 * **only** `app.current_user`.
 *
 * **The account id is bound, not compared.** There is no `WHERE m.account_id = $1` below, for the
 * same reason no statement in the sibling repository names an organization: the policies are what
 * scope the read, and a predicate restating them would be a second source of truth that drifts the
 * moment either changes. Bound to nobody, this returns nothing — fail-closed, not an error.
 *
 * The transaction is read-only work but a transaction all the same: `set_config(..., true)` is
 * transaction-local, so without one the binding would not survive to the next statement — and
 * session-scoped binding is prohibited outright, since PgBouncer's transaction pooling would leak
 * it to the next borrower of the connection.
 */
@Injectable()
export class AccountMembershipStoreRepository implements AccountMembershipStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async listForAccount(accountId: string): Promise<AccountMembership[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_user', accountId]);
      const rows = (await queryRunner.query(
        `SELECT m.id, m.organization_id, o.name AS organization_name, m.role, m.created_at
           FROM identity.membership m
           JOIN core.organization o ON o.id = m.organization_id
          WHERE m.status = $1
          ORDER BY o.name, m.id`,
        [MEMBERSHIP_STATUS.ACTIVE],
      )) as AccountMembershipRow[];

      await queryRunner.commitTransaction();
      return rows.map((row) => ({
        membershipId: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        role: row.role,
        joinedAt: row.created_at,
      }));
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Always. A runner released on neither path is a connection never returned to a pool of ten.
      await queryRunner.release();
    }
  }
}

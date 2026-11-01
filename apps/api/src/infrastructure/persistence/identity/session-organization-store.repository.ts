import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { SessionOrganizationStore } from '@api/modules/identity/membership/interfaces/session-organization-store.interface';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';

/**
 * The `SessionOrganizationStore` adapter (task 83.1): one conditional `UPDATE` on its own
 * transaction, binding only `app.current_user` — the port says why it cannot borrow the request's.
 *
 * **The membership is found by the binding, not by an account predicate**, as
 * `AccountMembershipStoreRepository` finds it: `membership_self_select` scopes the subquery to the
 * bound account, so a missing binding matches nothing and refuses rather than admitting anyone.
 * **The session is found by both ids**, because `identity.session` has no policy to do it.
 *
 * `RETURNING` answers `[rows, count]` after an `UPDATE`, which `returnedRows` normalises; a
 * statement that matched no row returns none, and that is the refusal.
 */
@Injectable()
export class SessionOrganizationStoreRepository implements SessionOrganizationStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async pointSessionAt(input: {
    readonly sessionId: string;
    readonly accountId: string;
    readonly organizationId: string;
  }): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_user', input.accountId]);
      const pointed = returnedRows<{ id: string }>(
        await queryRunner.query(
          `UPDATE identity.session
              SET active_organization_id = $3
            WHERE id = $1
              AND account_id = $2
              AND EXISTS (SELECT 1
                            FROM identity.membership m
                           WHERE m.organization_id = $3
                             AND m.status = $4)
        RETURNING id`,
          [input.sessionId, input.accountId, input.organizationId, MEMBERSHIP_STATUS.ACTIVE],
        ),
      );

      await queryRunner.commitTransaction();
      return pointed.length === 1;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

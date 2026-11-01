import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { MemberActivityStore } from '@api/modules/identity/session/interfaces/member-activity-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `AuthGuard`'s write of FR-56's *last activity* (28 Sep 2026) — the column the membership migration left for
 * task 28's guard to fill, and which nothing filled until now.
 *
 * **Its own short transaction, not the request's.** `TenantTransactionGuard` opens the request's transaction
 * after `AuthGuard` returns, and holds it for the request's life; a row lock taken in there would make every
 * parallel request of the same member wait for the first to finish. Here the lock lives for one statement, and a
 * second request racing the first re-reads the row after it commits and finds nothing left to write.
 *
 * **One conditional statement**, so a request inside the grain costs an index lookup and writes nothing. The
 * update policy needs the tenant bound (`membership_tenant_update`), and the account is bound beside it so the
 * row's writer is the member themself. The capture trigger ignores `last_active_at` — the migration's reason:
 * presence is not a value anyone changed — so no audit row follows.
 */
@Injectable()
export class MemberActivityStoreRepository implements MemberActivityStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async record(input: Parameters<MemberActivityStore['record']>[0]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT set_config($1, $2, true), set_config($3, $4, true)',
        ['app.current_org', input.organizationId, 'app.current_user', input.accountId],
      );
      await manager.query(
        `UPDATE identity.membership
            SET last_active_at = $2
          WHERE id = $1
            AND (last_active_at IS NULL OR last_active_at < $3)`,
        [input.membershipId, input.at, input.unlessSince],
      );
    });
  }
}

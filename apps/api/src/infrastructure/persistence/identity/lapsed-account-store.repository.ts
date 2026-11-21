import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { LapsedAccountStore } from '@api/modules/identity/account/interfaces/lapsed-account-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `LAPSED_ACCOUNT_STORE` on the worker, as `esg_worker` (task 200; `architecture.md` §12.5.6's task-200 row).
 *
 * **It calls the function and states nothing itself.** `identity.reclaim_lapsed_accounts()` (migration
 * `1794355200000`) holds OQ-52's predicate and runs as the table's owner; this role may execute it and holds no `DELETE`
 * on `identity.account`, so nothing written here can widen what goes. One statement, so its own transaction: the
 * deletions and their cascades commit together or not at all.
 */
@Injectable()
export class LapsedAccountStoreRepository implements LapsedAccountStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async reclaimLapsed(): Promise<number> {
    const rows: { reclaimed: number }[] = await this.dataSource.query(
      `SELECT identity.reclaim_lapsed_accounts() AS reclaimed`,
    );
    return rows[0].reclaimed;
  }
}

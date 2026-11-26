import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import type {
  NotificationRetentionStore,
  PurgedNotifications,
} from '@api/modules/platform/notification/interfaces/notification-retention-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `NOTIFICATION_RETENTION_STORE` on the worker, as `esg_worker` (task 163; `architecture.md` §12.5.6's task-163 row).
 *
 * **Each statement deletes the whole table, and that is safe only because of the policy it meets.** The retention is
 * each table's `DELETE` policy `TO esg_worker` (migration `1794268800000`), so `DELETE FROM` with no `WHERE` removes
 * exactly what has run out and nothing else — the period is stated once, in the database. Two things keep it that way:
 *
 * - **No organization is bound**, so the transaction is the `DataSource`'s own and never `TENANT_WORK`'s: each policy
 *   holds only while nothing is bound, and a bound purge deletes nothing.
 * - **No `WHERE` and no `RETURNING`.** Either would read the rows, and reading is filtered by the worker's `SELECT`
 *   policies, which see a notice only under its organization's binding — so a purge that read would delete nothing,
 *   and quietly. The count is the command's own, `affected`.
 *
 * **Notices, then cancellations, then the ended organizations**, in one transaction: an organization's record of
 * ending is what dates its rows, so it goes last and with them, never before.
 */
@Injectable()
export class NotificationRetentionStoreRepository implements NotificationRetentionStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async purgeExpired(): Promise<PurgedNotifications> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      // A notice's deliveries go by the cascade, which row security does not filter.
      const notices = await this.deleted(runner, `DELETE FROM notification.notification`);
      const cancellations = await this.deleted(runner, `DELETE FROM notification.cancellation`);
      const endedOrganizations = await this.deleted(runner, `DELETE FROM notification.ended_organization`);
      await runner.commitTransaction();
      return { notices, cancellations, endedOrganizations };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async deleted(runner: QueryRunner, statement: string): Promise<number> {
    const result = await runner.query(statement, [], true);
    return result.affected ?? 0;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  SuppressAddressCommand,
  SuppressionStore,
} from '@api/modules/platform/notification/interfaces/suppression-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `SUPPRESSION_STORE` over `notification.suppressed_address` (task 51.4; §12.5.6's task-51.4 row;
 * FR-171, NFR-107).
 *
 * **It binds no tenant, and that is the one thing to know before editing it.** Every other repository in
 * this schema opens a transaction bound to the notice's organization, because every other table in it is
 * tenant-owned and under RLS. This table is not: a bounced mailbox is undeliverable for everyone, so the
 * row has no `organization_id`, the table has no policies, and binding one here would be a line that
 * looks careful and governs nothing.
 *
 * **Repeating `suppress` is not an error.** A second hard bounce for the same address is the same fact,
 * so the insert takes the first row's word for when it happened rather than moving the timestamp —
 * `DO NOTHING`, not `DO UPDATE`. What a reader wants from that column is *when did we stop trying*.
 */
@Injectable()
export class SuppressionStoreRepository implements SuppressionStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async isSuppressed(addressKey: string): Promise<boolean> {
    // `DataSource.query` is generic and unoverloaded, so the row type is a type ARGUMENT here — a
    // trailing assertion is what `no-unnecessary-type-assertion` flags (`apps/api/CLAUDE.md`).
    const rows = await this.dataSource.query<{ '?column?': number }[]>(
      `SELECT 1 FROM notification.suppressed_address WHERE address_key = $1`,
      [addressKey],
    );
    return rows.length > 0;
  }

  async suppress(command: SuppressAddressCommand): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO notification.suppressed_address (address_key, reason, detail)
            VALUES ($1, $2, $3)
       ON CONFLICT (address_key) DO NOTHING`,
      [command.addressKey, command.reason, command.detail],
    );
  }
}

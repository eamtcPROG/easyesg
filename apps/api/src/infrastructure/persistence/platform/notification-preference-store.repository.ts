import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import type {
  NotificationPreferenceStore,
  ReplaceNotificationPreferencesCommand,
} from '@api/modules/platform/notification/interfaces/notification-preference-store.interface';
import { isNotificationChannel } from '@api/modules/platform/notification/models/notification-category.model';
import type { NotificationPreferencePair } from '@api/modules/platform/notification/models/notification-preference.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `NOTIFICATION_PREFERENCE_STORE` over `notification.preference` (task 52.1; §12.5.6's task-52.1 rows (1), (4)).
 *
 * **It binds no tenant**, `SuppressionStoreRepository`'s case for a different reason: a preference follows the person
 * across organizations, so the row carries no organization and the table no policies. What confines a statement to
 * one person is the account id every statement names, which the service takes from the session — the shape of every
 * `/account/*` store.
 *
 * **The replace is two statements in one transaction, and neither touches a pair outside `offered`.** The delete
 * removes the offered pairs the write leaves on; the insert adds the ones it switches off, `DO NOTHING` on a pair
 * already off so its row keeps the time it was first switched off.
 */
@Injectable()
export class NotificationPreferenceStoreRepository implements NotificationPreferenceStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async switchedOff(query: { readonly accountId: string }): Promise<readonly NotificationPreferencePair[]> {
    // The row type is a type ARGUMENT on `DataSource.query` (`apps/api/CLAUDE.md`).
    const rows = await this.dataSource.query<{ category_key: string; channel: string }[]>(
      `SELECT category_key, channel FROM notification.preference
        WHERE account_id = $1
        ORDER BY category_key, channel`,
      [query.accountId],
    );
    // Narrowed, never cast: a row for a category no release raises any more is a choice about nothing, and dropping it
    // here is what keeps it from reaching a read that would have to explain it.
    return rows.flatMap(({ category_key: categoryKey, channel }) =>
      isNotificationCategoryKey(categoryKey) && isNotificationChannel(channel) ? [{ categoryKey, channel }] : [],
    );
  }

  async replace(command: ReplaceNotificationPreferencesCommand): Promise<void> {
    const offered = columns(command.offered);
    const switchedOff = columns(command.switchedOff);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM notification.preference p
          USING unnest($2::text[], $3::text[]) AS o(category_key, channel)
          WHERE p.account_id = $1
            AND p.category_key = o.category_key AND p.channel = o.channel
            AND NOT EXISTS (SELECT 1 FROM unnest($4::text[], $5::text[]) AS s(category_key, channel)
                             WHERE s.category_key = p.category_key AND s.channel = p.channel)`,
        [command.accountId, offered.categoryKeys, offered.channels, switchedOff.categoryKeys, switchedOff.channels],
      );
      await manager.query(
        `INSERT INTO notification.preference (account_id, category_key, channel)
         SELECT $1, s.category_key, s.channel FROM unnest($2::text[], $3::text[]) AS s(category_key, channel)
             ON CONFLICT (account_id, category_key, channel) DO NOTHING`,
        [command.accountId, switchedOff.categoryKeys, switchedOff.channels],
      );
    });
  }
}

/** Pairs as two parallel arrays, the shape `unnest` takes them in. */
const columns = (pairs: readonly NotificationPreferencePair[]) => ({
  categoryKeys: pairs.map((pair) => pair.categoryKey),
  channels: pairs.map((pair) => pair.channel),
});

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { isNotificationCategoryKey, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '@api/modules/platform/notification/constants/notification-category.constants';
import { NotificationCategoryChangedError } from '@api/modules/platform/notification/errors/notification.errors';
import type {
  CategoryConsoleStore,
  CategoryPublicationCommand,
  StoredCategory,
  StoredSwitchOffs,
} from '@api/modules/platform/notification/interfaces/category-console-store.interface';
import { isNotificationChannel } from '@api/modules/platform/notification/models/notification-category.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `CATEGORY_CONSOLE_STORE` (task 67.10; §12.5.6's task-67.10 row) — A-17's reads and its publication.
 *
 * **The configuration store's own tables, as `esg_app`**, the task-67.11 row's reading: the unbounded slot of each
 * `notification_category` artefact, its version and the operator who published it — `identity.admin_account`'s address,
 * absent for a seeded revision. **The switch-offs as `esg_app` too**: `notification.preference` carries no organization
 * and no row security, so the count reads no tenant's data and acquires nothing.
 *
 * **A publication goes through `ConfigurationPublisher` with the revision it was made against**, whose advisory lock
 * makes a concurrent save a refusal rather than a silent overwrite; then the acting replica polls, so what it serves
 * changes at once and other replicas within AD-4's interval.
 */
@Injectable()
export class CategoryConsoleStoreRepository implements CategoryConsoleStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
  ) {}

  async inForce(): Promise<readonly StoredCategory[]> {
    const rows = await this.dataSource.query<InForceRow[]>(
      `SELECT s.scope, v.revision, v.payload, v.published_at, operator.email AS published_by,
              previous.payload AS previous_payload
         FROM config.entry_schedule s
         JOIN config.entry_version v ON v.id = s.version_id
         LEFT JOIN config.entry_version previous
                ON previous.kind = v.kind AND previous.scope = v.scope AND previous.revision = v.revision - 1
         LEFT JOIN identity.admin_account operator ON operator.id = v.created_by
        WHERE s.kind = $1 AND s.validity = '[,)'::daterange`,
      [NOTIFICATION_CATEGORY_CONFIG_KIND],
    );
    return rows.flatMap((row) =>
      isNotificationCategoryKey(row.scope)
        ? [
            {
              categoryKey: row.scope,
              revision: row.revision,
              payload: row.payload,
              publishedAt: row.published_at,
              publishedBy: row.published_by,
              previousPayload: row.previous_payload,
            },
          ]
        : [],
    );
  }

  async payloadAt(query: {
    readonly categoryKey: NotificationCategoryKey;
    readonly revision: number;
  }): Promise<Record<string, unknown> | null> {
    const rows = await this.dataSource.query<{ payload: Record<string, unknown> }[]>(
      `SELECT payload FROM config.entry_version WHERE kind = $1 AND scope = $2 AND revision = $3`,
      [NOTIFICATION_CATEGORY_CONFIG_KIND, query.categoryKey, query.revision],
    );
    return rows[0]?.payload ?? null;
  }

  async switchOffs(): Promise<ReadonlyMap<NotificationCategoryKey, StoredSwitchOffs>> {
    const rows = await this.dataSource.query<{ category_key: string; channel: string | null; people: number }[]>(
      `SELECT category_key, channel, count(DISTINCT account_id)::int AS people
         FROM notification.preference
        GROUP BY GROUPING SETS ((category_key, channel), (category_key))`,
    );
    const counts = new Map<NotificationCategoryKey, { byChannel: Partial<Record<string, number>>; people: number }>();
    for (const row of rows) {
      if (!isNotificationCategoryKey(row.category_key)) continue;
      const entry = counts.get(row.category_key) ?? { byChannel: {}, people: 0 };
      if (row.channel === null) entry.people = row.people;
      else if (isNotificationChannel(row.channel)) entry.byChannel[row.channel] = row.people;
      counts.set(row.category_key, entry);
    }
    return counts;
  }

  async publish(command: CategoryPublicationCommand): Promise<{ readonly id: string; readonly revision: number }> {
    const version = await this.publisher
      .publish({
        kind: NOTIFICATION_CATEGORY_CONFIG_KIND,
        scope: command.categoryKey,
        payload: { channels: [...command.behaviour.channels], classification: command.behaviour.classification },
        actorId: command.operatorId,
        expectedRevision: command.expectedRevision,
      })
      .catch((error: unknown) => {
        throw error instanceof ConfigurationRevisionMismatchError ? new NotificationCategoryChangedError() : error;
      });

    await this.configurationStore.poll();
    return version;
  }
}

interface InForceRow {
  scope: string;
  revision: number;
  payload: Record<string, unknown>;
  published_at: Date | null;
  published_by: string | null;
  previous_payload: Record<string, unknown> | null;
}

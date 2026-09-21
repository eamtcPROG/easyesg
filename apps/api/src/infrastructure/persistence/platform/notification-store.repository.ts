import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import type {
  DeliverInAppCommand,
  NoticeRef,
  NotificationRecord,
  NotificationStore,
  OpenNotificationCommand,
  RecordEmailAcceptedCommand,
} from '@api/modules/platform/notification/interfaces/notification-store.interface';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel,
} from '@api/modules/platform/notification/models/notification-category.model';
import {
  DELIVERY_OUTCOME,
  NOTIFICATION_STATE,
  type NotificationState,
} from '@api/modules/platform/notification/models/notification-record.model';
import { CORE_DATA_SOURCE } from '../data-source';

interface NoticeRow {
  id: string;
  state: NotificationState;
  deep_link: string;
  params: Record<string, unknown>;
}

/**
 * `NOTIFICATION_STORE` over the `notification` schema (task 50.1.1; §12.5.6's task-50.1 row; FR-160, FR-167, FR-170).
 *
 * **On the worker, as `esg_worker`, in a transaction of its own bound to the notice's organization** — §7.6's
 * worker binding: the job carries the organization, and no request exists to hold a runner. `app.current_org` is
 * bound and `app.current_user` is not, because nobody is acting: the dispatcher writes what a producer decided.
 * Each method is one short transaction and each is safe to repeat; the delivery flow re-derives what is owed from
 * what these statements recorded.
 *
 * **FR-167's deduplication is the index, not a read-then-write.** `open` inserts under the raise's id with
 * `ON CONFLICT … DO NOTHING` against `notification_open_key`, so two raises for one key meeting on two workers
 * produce one notice: the second waits for the first to commit, inserts nothing, and reads the notice the first
 * opened. The conflict target restates the index's predicate as a literal, because PostgreSQL infers a partial
 * index from a predicate it can prove when planning: a bind parameter there works under a custom plan and fails
 * the statement under a generic one — *"no unique or exclusion constraint matching the ON CONFLICT specification"*,
 * measured with `plan_cache_mode = force_generic_plan` — so the literal keeps the insert independent of the plan
 * cache.
 */
@Injectable()
export class NotificationStoreRepository implements NotificationStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  open(command: OpenNotificationCommand): Promise<NotificationRecord> {
    return this.inOrganization(command.organizationId, async (runner) => {
      // A redelivered job: its notice already carries its id, whatever state that notice is in now.
      const own = (await runner.query(
        `SELECT id, state, deep_link, params FROM notification.notification WHERE id = $1`,
        [command.notificationId],
      )) as NoticeRow[];
      const notice = own[0] ?? (await this.admit(runner, command));

      const delivered = (await runner.query(
        `SELECT recipient_account_id, channel FROM notification.delivery WHERE notification_id = $1`,
        [notice.id],
      )) as { recipient_account_id: string; channel: NotificationChannel }[];
      return {
        notificationId: notice.id,
        state: notice.state,
        deepLink: notice.deep_link,
        params: notice.params,
        delivered: delivered.map((row) => ({ recipientId: row.recipient_account_id, channel: row.channel })),
      };
    });
  }

  deliverInApp(command: DeliverInAppCommand): Promise<void> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await runner.query(
        `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
         SELECT $1, $2, recipient, $3, $4 FROM unnest($5::uuid[]) AS recipient
         ON CONFLICT (notification_id, recipient_account_id, channel) DO NOTHING`,
        [
          command.notificationId,
          command.organizationId,
          NOTIFICATION_CHANNEL.IN_APP,
          DELIVERY_OUTCOME.DELIVERED,
          command.recipientIds,
        ],
      );
    });
  }

  recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await runner.query(
        `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (notification_id, recipient_account_id, channel) DO NOTHING`,
        [
          command.notificationId,
          command.organizationId,
          command.recipientId,
          NOTIFICATION_CHANNEL.EMAIL,
          DELIVERY_OUTCOME.ACCEPTED,
        ],
      );
    });
  }

  markDelivered(command: NoticeRef): Promise<void> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await runner.query(
        `UPDATE notification.notification SET state = $2, delivered_at = now() WHERE id = $1 AND state = $3`,
        [command.notificationId, NOTIFICATION_STATE.DELIVERED, NOTIFICATION_STATE.RAISED],
      );
    });
  }

  /** Opens a notice under the raise's id, or — when an open one holds its key — answers that one. */
  private async admit(runner: QueryRunner, command: OpenNotificationCommand): Promise<NoticeRow> {
    const opened = (await runner.query(
      `INSERT INTO notification.notification
              (id, organization_id, category_key, subject_ref, recipient_scope, deep_link, params)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (organization_id, category_key, subject_ref, recipient_scope)
          WHERE state <> '${NOTIFICATION_STATE.CANCELLED}'
       DO NOTHING
       RETURNING id, state, deep_link, params`,
      [
        command.notificationId,
        command.organizationId,
        command.categoryKey,
        command.subjectRef,
        command.recipientScope,
        command.deepLink,
        JSON.stringify(command.params),
      ],
    )) as NoticeRow[];
    if (opened[0]) return opened[0];

    const open = (await runner.query(
      `SELECT id, state, deep_link, params FROM notification.notification
        WHERE organization_id = $1 AND category_key = $2 AND subject_ref = $3 AND recipient_scope = $4
          AND state <> $5`,
      [
        command.organizationId,
        command.categoryKey,
        command.subjectRef,
        command.recipientScope,
        NOTIFICATION_STATE.CANCELLED,
      ],
    )) as NoticeRow[];
    // Only a cancellation between the two statements can leave neither; the job fails, and run again it opens one.
    if (!open[0]) throw new Error(`Notification ${command.notificationId}'s open notice closed while it was admitted.`);
    return open[0];
  }

  /** One short transaction bound to the organization, committed on success and rolled back on anything else. */
  private async inOrganization<T>(organizationId: string, work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId]);
      const result = await work(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

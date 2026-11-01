import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { SECRET_CIPHER, type SecretCipher } from '@api/contracts/secret-cipher.port';
import type {
  CancelNoticeCommand,
  NotificationCancellationStore,
} from '@api/modules/platform/notification/interfaces/notification-cancellation-store.interface';
import type {
  DeliverInAppCommand,
  NoticeRef,
  NotificationRecord,
  NotificationStore,
  OpenNotificationCommand,
  RecordEmailAcceptedCommand,
  RecordOptedOutCommand,
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
 * `ON CONFLICT … DO UPDATE` against `notification_open_key`, so two raises for one key produce one notice: the
 * second meets the first's row, moves its `last_raised_at` forward and answers it, in the same statement. The
 * conflict target restates the index's predicate as a literal, because PostgreSQL infers a partial index from a
 * predicate it can prove when planning: a bind parameter there works under a custom plan and fails the statement
 * under a generic one — *"no unique or exclusion constraint matching the ON CONFLICT specification"*, measured with
 * `plan_cache_mode = force_generic_plan` — so the literal keeps the insert independent of the plan cache.
 *
 * **A cancellation and a raise of one key are serialized by the key's lock** (task 50.1.3; §12.5.6's task-50.1 row
 * (12)): `open` and `cancel` each take a transaction-scoped advisory lock on the key before reading anything, so
 * whichever runs second sees the other's commit. Without it, a raise could read *no cancellation* while a
 * cancellation read *no open notice*, and both commit — the stale notice the row exists to prevent. The key is
 * hashed, so a collision only makes two keys' writes wait on each other for one transaction: task 142's seat lock
 * and its reasoning. `NOTIFICATION_CANCELLATION_STORE` is this class too.
 */
@Injectable()
export class NotificationStoreRepository implements NotificationStore, NotificationCancellationStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    /** Seals the link a verification, reset or invitation sent — at the persistence boundary, never in a use case. */
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  open(command: OpenNotificationCommand): Promise<NotificationRecord> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await holdKeyLock(runner, command);
      // A redelivered job: its notice already carries its id, whatever state that notice is in now.
      const own = (await runner.query(
        `SELECT id, state, deep_link, params FROM notification.notification WHERE id = $1`,
        [command.notificationId],
      )) as NoticeRow[];
      if (!own[0] && (await this.supersededByCancellation(runner, command))) {
        // Row (12): the condition was cleared after this raise was made, so it opens nothing and delivers nothing.
        return {
          notificationId: command.notificationId,
          state: NOTIFICATION_STATE.CANCELLED,
          deepLink: command.deepLink,
          params: command.params,
          delivered: [],
        };
      }
      const notice = own[0] ?? (await this.admit(runner, command));

      const delivered = (await runner.query(
        `SELECT recipient_account_id, channel FROM notification.delivery WHERE notification_id = $1`,
        [notice.id],
      )) as { recipient_account_id: string | null; channel: NotificationChannel }[];
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

  /** `deliverInApp`'s statement with the channel given and the outcome `opted_out` (task 52.2.1). */
  recordOptedOut(command: RecordOptedOutCommand): Promise<void> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await runner.query(
        `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
         SELECT $1, $2, recipient, $3, $4 FROM unnest($5::uuid[]) AS recipient
         ON CONFLICT (notification_id, recipient_account_id, channel) DO NOTHING`,
        [
          command.notificationId,
          command.organizationId,
          command.channel,
          DELIVERY_OUTCOME.OPTED_OUT,
          command.recipientIds,
        ],
      );
    });
  }

  /**
   * An account's delivery, or an address's (task 50.1.4, row (16)) — each against the uniqueness its kind has, so a
   * redelivered job records nothing twice either way. The address conflict target restates its partial index's
   * predicate as a literal, `admit`'s reason.
   */
  recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void> {
    const toAccount = 'accountId' in command.recipient;
    return this.inOrganization(command.organizationId, async (runner) => {
      await runner.query(
        toAccount
          ? `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (notification_id, recipient_account_id, channel) DO NOTHING`
          : `INSERT INTO notification.delivery (notification_id, organization_id, recipient_address, channel, outcome)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (notification_id, recipient_address, channel) WHERE recipient_address IS NOT NULL DO NOTHING`,
        [
          command.notificationId,
          command.organizationId,
          toAccount ? command.recipient.accountId : command.recipient.address,
          NOTIFICATION_CHANNEL.EMAIL,
          // The channel decided it (task 51.4), not this adapter: accepted, bounced or suppressed.
          command.outcome,
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

  /**
   * FR-167's withdrawal (task 50.1.3): the key's cancellation time moved forward, never back, and its open notice
   * closed if that notice's latest raise is no later — one raised again after the cancellation found its condition
   * outstanding again, and stays open. A cancellation and a raise made in one transaction share a time, and the
   * cancellation wins: it is the later call.
   */
  cancel(command: CancelNoticeCommand): Promise<{ readonly inAppRecipientIds: readonly string[] }> {
    return this.inOrganization(command.organizationId, async (runner) => {
      await holdKeyLock(runner, command);
      const key = [command.organizationId, command.categoryKey, command.subjectRef, command.recipientScope];
      await runner.query(
        `INSERT INTO notification.cancellation
                (organization_id, category_key, subject_ref, recipient_scope, cancelled_at)
         VALUES ($1, $2, $3, $4, ${atMicros('$5')})
         ON CONFLICT (organization_id, category_key, subject_ref, recipient_scope)
         DO UPDATE SET cancelled_at = GREATEST(notification.cancellation.cancelled_at, EXCLUDED.cancelled_at)`,
        [...key, command.cancelledAtMicros],
      );
      // One statement: the notices it closes, and — for task 148's hint — the accounts that held them in their centre.
      const recipients = (await runner.query(
        `WITH closed AS (
           UPDATE notification.notification SET state = $6, cancelled_at = ${atMicros('$5')}
            WHERE organization_id = $1 AND category_key = $2 AND subject_ref = $3 AND recipient_scope = $4
              AND state <> $6 AND last_raised_at <= ${atMicros('$5')}
           RETURNING id)
         SELECT DISTINCT d.recipient_account_id AS id
           FROM notification.delivery d JOIN closed ON d.notification_id = closed.id
          WHERE d.channel = $7 AND d.outcome = $8 AND d.recipient_account_id IS NOT NULL`,
        [...key, command.cancelledAtMicros, NOTIFICATION_STATE.CANCELLED, NOTIFICATION_CHANNEL.IN_APP, DELIVERY_OUTCOME.DELIVERED],
      )) as { id: string }[];
      return { inAppRecipientIds: recipients.map((row) => row.id) };
    });
  }

  /** Whether the key was cancelled at or after this raise was made — row (12)'s refusal. */
  private async supersededByCancellation(runner: QueryRunner, command: OpenNotificationCommand): Promise<boolean> {
    const rows = (await runner.query(
      `SELECT 1 FROM notification.cancellation
        WHERE organization_id = $1 AND category_key = $2 AND subject_ref = $3 AND recipient_scope = $4
          AND cancelled_at >= ${atMicros('$5')}`,
      [command.organizationId, command.categoryKey, command.subjectRef, command.recipientScope, command.raisedAtMicros],
    )) as unknown[];
    return rows.length > 0;
  }

  /**
   * Opens a notice under the raise's id, or — when an open one holds its key — moves that one's latest raise forward
   * and answers it. One statement either way: the key's lock is already held, and `DO UPDATE` returns the row it
   * met, so there is no second read to race.
   */
  private async admit(runner: QueryRunner, command: OpenNotificationCommand): Promise<NoticeRow> {
    const [notice] = (await runner.query(
      // `application` is written here and never in the `DO UPDATE`: a fold contributes recipients and a later raise
      // time, and leaves what the notice says and where it leads as it was opened (task 165; row (18)).
      `INSERT INTO notification.notification
              (id, organization_id, category_key, subject_ref, recipient_scope, deep_link, application, params,
               raised_at, last_raised_at, sealed_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, ${atMicros('$9')}, ${atMicros('$9')}, $10)
       ON CONFLICT (organization_id, category_key, subject_ref, recipient_scope)
          WHERE state <> '${NOTIFICATION_STATE.CANCELLED}'
       DO UPDATE SET last_raised_at = GREATEST(notification.notification.last_raised_at, EXCLUDED.last_raised_at)
       RETURNING id, state, deep_link, params`,
      [
        command.notificationId,
        command.organizationId,
        command.categoryKey,
        command.subjectRef,
        command.recipientScope,
        command.deepLink,
        command.application,
        JSON.stringify(command.params),
        command.raisedAtMicros,
        command.sealedLink === undefined ? null : this.cipher.seal(command.sealedLink),
      ],
    )) as NoticeRow[];
    return notice;
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

/**
 * An outbox time in epoch microseconds, as a `timestamptz`, by integer arithmetic — so the microsecond the database
 * wrote is the one compared (`EpochMicros`). A bind parameter's placeholder, never a value, is what is interpolated.
 */
const atMicros = (placeholder: string): string =>
  `(timestamptz 'epoch' + ${placeholder}::bigint * interval '1 microsecond')`;

interface NoticeKey {
  readonly organizationId: string;
  readonly categoryKey: string;
  readonly subjectRef: string;
  readonly recipientScope: string;
}

/**
 * The name the key's lock is taken under, spelled as a JSON array so a subject containing a separator cannot share a
 * spelling with another key. Exported for `notification-store.e2e-spec.ts`, which takes the same lock from outside to
 * show that `open` and `cancel` both wait on it — a race cannot be shown to be absent by running it.
 */
export const notificationKeyLockName = (key: NoticeKey): string =>
  `notification-key:${JSON.stringify([key.organizationId, key.categoryKey, key.subjectRef, key.recipientScope])}`;

/**
 * The key's transaction-scoped lock — `pg_advisory_xact_lock`, never session-scoped, for `holdSeatLock`'s reason:
 * PgBouncer's transaction pooling would hand a session lock to the connection's next borrower.
 */
const holdKeyLock = async (runner: QueryRunner, key: NoticeKey): Promise<void> => {
  await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [notificationKeyLockName(key)]);
};

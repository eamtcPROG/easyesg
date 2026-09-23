import type { DataSource } from 'typeorm';
import type { EmailPort } from '@api/contracts/email.port';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import { HmacUnsubscribeTokens } from '@api/infrastructure/adapters/unsubscribe-token/hmac-unsubscribe-tokens';
import { NotificationRecipientsRepository } from '@api/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationPreferenceStoreRepository } from '@api/infrastructure/persistence/platform/notification-preference-store.repository';
import { NotificationStoreRepository } from '@api/infrastructure/persistence/platform/notification-store.repository';
import { SuppressionStoreRepository } from '@api/infrastructure/persistence/platform/suppression-store.repository';
import { NOTIFICATION_CHANNEL } from '@api/modules/platform/notification/models/notification-category.model';
import { EmailChannelService } from '@api/modules/platform/notification/services/email-channel.service';
import { NotificationDeliveryService } from '@api/modules/platform/notification/services/notification-delivery.service';
import { DeliverLinkNotice } from '@api/modules/platform/notification/use-cases/deliver-link-notice.use-case';
import { required } from './database';

/**
 * The worker's store over a connection, sealing with the key the entrypoints hold (task 50.1.4: it seals the link a
 * verification, reset or invitation sent). One constructor for every suite, so none builds its own cipher.
 */
export const notificationStore = (worker: DataSource): NotificationStoreRepository =>
  new NotificationStoreRepository(worker, new AesGcmSecretCipher(required('SECRET_ENCRYPTION_KEY')));

/** `SUPPRESSION_STORE` over the same connection (task 51.4). It binds no tenant: the table carries none. */
export const suppressionStore = (worker: DataSource): SuppressionStoreRepository =>
  new SuppressionStoreRepository(worker);

/**
 * `NOTIFICATION_OPT_OUTS` over the same connection (task 52.2.1): who switched a category off, read as `esg_worker`,
 * which holds `SELECT` on `notification.preference` and nothing more.
 */
export const optOuts = (worker: DataSource): NotificationPreferenceStoreRepository =>
  new NotificationPreferenceStoreRepository(worker);

/**
 * `UNSUBSCRIBE_TOKENS` under the key the entrypoints hold (task 52.2.2), so a link a suite's delivery signs is one the
 * api it drives will read — `notificationStore`'s rule for the cipher, for the same reason.
 */
export const unsubscribeTokens = (): HmacUnsubscribeTokens =>
  new HmacUnsubscribeTokens(required('UNSUBSCRIBE_SIGNING_KEY'));

/**
 * `NOTIFICATION_DELIVERY` as the worker builds it, over a connection as `esg_worker` and a provider the suite records
 * (task 50.1.4) — the real store, the real account lookup, the real email channel. **The channel decision is the one
 * piece stubbed**, answering email: the category catalogue's rules are 49.3's suite, and a notice delivered from its
 * producer's own event goes by email whatever else its category names (§12.5.6's task-50.1 row (20)). A suite driving
 * one of those handlers wires this rather than a recording port, so what it proves is the path a deployment takes.
 */
export const linkNoticeDelivery = (input: {
  readonly worker: DataSource;
  readonly provider: EmailPort;
  readonly webOrigin: string;
  readonly consoleOrigin?: string;
}): NotificationDeliveryService =>
  new NotificationDeliveryService(
    new DeliverLinkNotice(
      new NotificationRecipientsRepository(input.worker),
      new EmailChannelService(input.provider, suppressionStore(input.worker)),
      { channelsFor: () => [NOTIFICATION_CHANNEL.EMAIL] },
      notificationStore(input.worker),
      { web: input.webOrigin, console: input.consoleOrigin ?? 'http://localhost:3200' },
    ),
  );

/**
 * The outbox row's time as the dispatcher reads it — epoch microseconds, a `bigint` the driver answers as a string —
 * for a suite's `SELECT` over `audit.outbox_event`, so the job it builds carries the time a deployment's would.
 */
export const OCCURRED_MICROS = `(extract(epoch FROM occurred_at) * 1000000)::bigint AS occurred_micros`;

/**
 * An outbox row as the dispatcher enqueues it: its payload, with the row's organization and time beside it. For a
 * suite that hands a row to a handler itself, so the job it builds is the one a deployment would.
 */
export const asJob = (row: {
  readonly payload: Record<string, unknown>;
  readonly organization_id: string | null;
  readonly occurred_micros: string;
}): Record<string, unknown> => ({
  ...row.payload,
  organizationId: row.organization_id,
  occurredAtMicros: Number(row.occurred_micros),
});

/**
 * Removes a suite's notices and their deliveries, as the owner (task 50.1.1).
 *
 * **Nothing in the product deletes a notice** — NFR-109's retention will, and brings its policy with it — so the
 * `notification` tables carry no `DELETE` policy, and `FORCE ROW LEVEL SECURITY` subjects the owner to that
 * absence: a plain `DELETE` as `esg_migrator` removes nothing and says so quietly (`apps/api/CLAUDE.md`, the task
 * 26.1 note). Neither table has a parent to cascade from, since an organization is referenced by id. So the owner
 * lifts `FORCE` for the one statement, inside a transaction that restores it before committing — DDL is
 * transactional, so no other session ever sees the table unforced.
 */
export const deleteNotificationsOf = async (owner: DataSource, organizationId: string): Promise<void> => {
  const runner = owner.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
    // The deliveries go by the cascade from their notice.
    await runner.query(`DELETE FROM notification.notification WHERE organization_id = $1`, [organizationId]);
    await runner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};

/**
 * Removes the notices a suite opened by their subjects, whatever organization holds them — a platform notice is
 * recorded under the one reserved id (row (17)), which every suite shares, so an organization-wide clean would
 * take other suites' notices with it. `deleteNotificationsOf`'s `FORCE` handling, for its reason.
 */
export const deleteNoticesAbout = async (owner: DataSource, subjectRefs: readonly string[]): Promise<void> => {
  if (subjectRefs.length === 0) return;
  const runner = owner.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(`ALTER TABLE notification.notification NO FORCE ROW LEVEL SECURITY`);
    await runner.query(`DELETE FROM notification.notification WHERE subject_ref = ANY($1)`, [subjectRefs]);
    await runner.query(`ALTER TABLE notification.notification FORCE ROW LEVEL SECURITY`);
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
};

/**
 * Clears FR-171's list for the addresses a suite bounced (task 51.4).
 *
 * **A suite that suppresses an address and does not clear it is not repeatable**, and this helper exists
 * because that is exactly what happened: the first run of `notification-store.e2e-spec.ts`'s bounce case
 * left the address suppressed, and the second run watched four unrelated cases send nothing and fail on
 * an empty `provider.sent`. Nothing cascades here — the table hangs off no notice and has no
 * `organization_id` — so it is cleaned by name or not at all.
 *
 * **As the owner, and no `FORCE` dance**: the table carries no RLS, because a bounced mailbox is
 * undeliverable for every tenant. It is the one table in this schema a `DELETE` reaches plainly.
 */
export const clearSuppressedAddresses = async (
  owner: DataSource,
  addresses: readonly string[],
): Promise<void> => {
  if (addresses.length === 0) return;
  await owner.query(`DELETE FROM notification.suppressed_address WHERE address_key = ANY($1)`, [
    addresses.map((address) => address.toLowerCase()),
  ]);
};

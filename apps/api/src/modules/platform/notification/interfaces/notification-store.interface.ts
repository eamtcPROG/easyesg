import type { NoticeApplication } from '@api/contracts/notification-delivery.port';
import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { EpochMicros } from '@api/contracts/types/time';
import type { NotificationChannel } from '../models/notification-category.model';
import type { DeliveryOutcome, NotificationState } from '../models/notification-record.model';

/**
 * The notification store, as the delivery flow asks it (task 50.1.1; §12.5.6's task-50.1 row; FR-160, FR-167,
 * FR-168, FR-170).
 *
 * **Module-internal, not in `contracts/`**: no other context reads or writes a notice's record — a producer
 * raises through `NotificationPort` and 50.1.2's centre is this module's own route. Each operation is **its own
 * transaction, bound to the notice's organization**, and each is safe to repeat: the delivery flow re-derives
 * what is owed from what is recorded, so a job that failed half-way and is run again completes the work rather
 * than repeating it.
 */
export interface NotificationStore {
  /**
   * The open notice this raise belongs to (FR-167). A raise whose own id is already recorded is a redelivered
   * job and answers that notice, whatever its state. **A raise no later than its key's latest cancellation is
   * superseded** and answers `cancelled` with nothing recorded (task 50.1.3; §12.5.6's task-50.1 row (12)).
   * Otherwise one open notice for the same organization, category, subject and recipient scope absorbs it, its
   * latest raise moved forward; otherwise the raise opens a notice under its own id.
   */
  open(command: OpenNotificationCommand): Promise<NotificationRecord>;
  /** Writes each recipient's in-app delivery — which is the delivery, since the centre is the store (FR-168). */
  deliverInApp(command: DeliverInAppCommand): Promise<void>;
  /** Records the email the provider accepted for one recipient (FR-170, row (7)). */
  recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void>;
  /** The dispatch finished: a `raised` notice becomes `delivered`, and any other state is left as it stands. */
  markDelivered(command: NoticeRef): Promise<void>;
}

/** A notice, named the way every statement against it is bound: by its organization as well as its id. */
export interface NoticeRef {
  readonly notificationId: string;
  readonly organizationId: string;
}

export interface OpenNotificationCommand extends NoticeRef {
  /** The raise's id — the outbox row's key — which a new notice adopts (§12.5.6's task-49.3 row (3)). */
  readonly notificationId: string;
  readonly categoryKey: NotificationCategoryKey;
  readonly subjectRef: string;
  /** The producer-named audience (§12.5.6's task-50.1 row (6)); part of FR-167's key. */
  readonly recipientScope: string;
  /** The raise's outbox time — the database's clock, in microseconds — which its key's cancellation is ordered against. */
  readonly raisedAtMicros: EpochMicros;
  readonly deepLink: string;
  /**
   * Which application `deepLink` opens (task 165) — the value the delivery already resolves its origin from, kept on
   * the record so a reader of the table needs no mapping from the category (NFR-109).
   */
  readonly application: NoticeApplication;
  readonly params: Record<string, unknown>;
  /**
   * The absolute link as sent, where it carries a secret — a verification, reset or invitation token (task 50.1.4,
   * row (15)). The store keeps it sealed beside `deepLink`, which carries none; a raised notice passes nothing.
   */
  readonly sealedLink?: string;
}

export interface DeliverInAppCommand extends NoticeRef {
  readonly recipientIds: readonly string[];
}

export interface RecordEmailAcceptedCommand extends NoticeRef {
  readonly recipient: RecordedRecipient;
  /**
   * What became of it (task 51.4): `accepted`, `bounced` or `suppressed`. The row is the evidence FR-170 asks
   * for, so a refusal is recorded as deliberately as an acceptance — an address nobody wrote to and an address
   * that refused are different answers to UC-174's question.
   */
  readonly outcome: DeliveryOutcome;
}

/** Whom a delivery names: an account, or — for someone who holds none — the address it went to (row (16)). */
export type RecordedRecipient = { readonly accountId: string } | { readonly address: string };

/** One recipient already reached on one channel. `recipientId` is null for a delivery made to an address. */
export interface RecordedDelivery {
  readonly recipientId: string | null;
  readonly channel: NotificationChannel;
}

/**
 * The notice as recorded. **Its content is the notice's, not the latest raise's**: a raise folded into an open
 * notice contributes recipients, and the ones it adds receive what the others received.
 */
export interface NotificationRecord {
  readonly notificationId: string;
  readonly state: NotificationState;
  readonly deepLink: string;
  readonly params: Record<string, unknown>;
  readonly delivered: readonly RecordedDelivery[];
}

export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');

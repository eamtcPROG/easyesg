import type { NotificationCentrePage, NotificationCentreQuery } from '../models/notification-centre.model';

/**
 * The centre as the request tier asks it (task 50.1.2; UC-165, UC-167; FR-161).
 *
 * **Every operation is on the request's own transaction and names no recipient**: the tenant transaction binds the
 * organization and the acting account, and the `notification` schema's policies answer only that account's rows
 * (UC-165; BR-NOT-5 for what they mark). So *mine* is not a parameter a caller could get wrong — a colleague's notice
 * is simply not there, and asking to read it is asking about a notice that does not exist.
 *
 * Module-internal, like `NOTIFICATION_STORE` beside it: the worker's store writes what a dispatch did, this one reads
 * what a recipient has and records what they did with it, and neither is another context's business.
 */
export interface NotificationCentreStore {
  /** One page of the recipient's centre, with the counts an Index's empty states need. */
  list(query: NotificationCentreQuery): Promise<NotificationCentrePage>;
  /** Unread and not dismissed, of notices still in the centre (UX-62). */
  countUnread(): Promise<number>;
  /**
   * Records that the recipient read the notice, once: a second mark keeps the first time (row (9)). Answers
   * `false` when the recipient holds no in-app delivery of it.
   */
  markRead(command: { readonly notificationId: string }): Promise<boolean>;
  /** Takes the notice out of the recipient's centre, once, and leaves its read time as it stands (row (9)). */
  dismiss(command: { readonly notificationId: string }): Promise<boolean>;
  /**
   * Records read every notice the unread count counts, each once (§12.5.6's task-50.2 row (2)), and answers how many
   * it marked. A dismissed notice is left as it stands: it has left the centre, and nobody read it.
   */
  markAllRead(): Promise<number>;
}

export const NOTIFICATION_CENTRE_STORE = Symbol('NOTIFICATION_CENTRE_STORE');

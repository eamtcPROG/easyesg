import type { RecordedDelivery } from '../interfaces/notification-store.interface';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * The recipients a notice still owes on one channel: those named that no recorded delivery on that channel has
 * reached (task 50.1.1; FR-167, FR-170).
 *
 * **What is owed is derived from what is recorded, every time**, and that is what makes a delivery safe to run
 * twice. A redelivered job finds its own earlier rows and owes nothing; a job that failed after the in-app rows
 * and before an email owes that email alone; a raise folded into an open notice owes only the people the notice
 * had not reached. Per channel, because a recipient reached in-app may still be owed the email.
 */
export const stillOwed = <R extends { readonly userId: string }>(input: {
  readonly recipients: readonly R[];
  readonly channel: NotificationChannel;
  readonly delivered: readonly RecordedDelivery[];
}): R[] => {
  const reached = new Set(
    input.delivered
      .filter((delivery) => delivery.channel === input.channel)
      .map((delivery) => delivery.recipientId),
  );
  return input.recipients.filter((recipient) => !reached.has(recipient.userId));
};

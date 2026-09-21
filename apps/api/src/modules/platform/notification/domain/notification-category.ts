import {
  isNotificationChannel,
  isNotificationClassification,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';

/**
 * A `notification_category` payload read as behaviour, or `null` when it cannot be (task 49.1).
 *
 * **Validated, never cast** — configuration is data someone edits, and A-17 will be where they edit it. A
 * payload is refused whole rather than read in part: a category whose channel list held one unknown word
 * among two known ones would otherwise send on a subset nobody chose. Refused are a missing or empty channel
 * list, a channel named twice, a channel or classification outside the vocabulary. **Members it does not
 * know are ignored**, so the task that adds a category's cadence (51.2) can publish it before every replica
 * reads it.
 */
export const readNotificationCategory = (
  payload: Record<string, unknown>,
): NotificationCategoryBehaviour | null => {
  const { channels, classification } = payload;
  if (!Array.isArray(channels) || channels.length === 0) return null;
  if (!channels.every(isNotificationChannel)) return null;
  if (new Set(channels).size !== channels.length) return null;
  if (!isNotificationClassification(classification)) return null;
  return { channels, classification };
};

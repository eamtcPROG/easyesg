import { ADDRESS_NOTICE_CATEGORIES, MANDATORY_NOTIFICATION_CATEGORIES, type NotificationCategoryKey } from '@api/contracts/notification.port';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
  type NotificationChannel,
} from '../models/notification-category.model';
import { PUBLICATION_REFUSAL, type PublicationRefusal } from '../models/category-console.model';

/**
 * Whether A-17 may put a behaviour in force for a category, and if not why (task 67.10; §12.5.6's task-67.10 row) — the
 * rules code declares and no operator overrides, asked on a publication and on a revert alike, so a revert cannot
 * restore what a publication would refuse.
 *
 * **In order of what a reader should fix first**: a mandatory category's classification, then its email, then an
 * address notice's in-app, then wording — the last because it is the one a release, not the operator, supplies. The
 * wording is asked of the caller (`worded`), since only the catalogue knows it.
 */
export const publicationRefusal = (input: {
  readonly categoryKey: NotificationCategoryKey;
  readonly behaviour: NotificationCategoryBehaviour;
  readonly worded: (channel: NotificationChannel) => boolean;
}): PublicationRefusal | null => {
  const { categoryKey, behaviour } = input;
  const mandatory = MANDATORY_NOTIFICATION_CATEGORIES.has(categoryKey);

  if (mandatory && behaviour.classification !== NOTIFICATION_CLASSIFICATION.TRANSACTIONAL) {
    return PUBLICATION_REFUSAL.MANDATORY_CLASSIFICATION;
  }
  if (mandatory && !behaviour.channels.includes(NOTIFICATION_CHANNEL.EMAIL)) {
    return PUBLICATION_REFUSAL.MANDATORY_WITHOUT_EMAIL;
  }
  if (ADDRESS_NOTICE_CATEGORIES.has(categoryKey) && behaviour.channels.includes(NOTIFICATION_CHANNEL.IN_APP)) {
    return PUBLICATION_REFUSAL.ADDRESS_NOTICE_IN_APP;
  }
  if (!behaviour.channels.every((channel) => input.worded(channel))) return PUBLICATION_REFUSAL.WORDING_MISSING;
  return null;
};

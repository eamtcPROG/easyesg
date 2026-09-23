import { ADDRESS_NOTICE_CATEGORIES, MANDATORY_NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { readNotificationCategory } from '../domain/notification-category';
import type { CategoryConsoleStore } from '../interfaces/category-console-store.interface';
import type { ConsoleCategory } from '../models/category-console.model';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';

/**
 * UC-176's read — every category this release raises, what code declares about it, what is in force and who put it
 * there, and how many people switched it off (task 67.10; FR-173; §12.5.6's task-67.10 row).
 *
 * **Every category, in the vocabulary's order, whether or not anything is in force**: a category with no artefact is
 * one an operator has to publish, and leaving it off the list would hide exactly that. **A payload is read as the
 * catalogue reads it** (`readNotificationCategory`), so what is unreadable is shown unreadable — the fail-closed state
 * the platform is actually in.
 */
export class ListConsoleCategories {
  constructor(private readonly store: CategoryConsoleStore) {}

  async execute(): Promise<readonly ConsoleCategory[]> {
    const [inForce, switchOffs] = await Promise.all([this.store.inForce(), this.store.switchOffs()]);

    return Object.values(NOTIFICATION_CATEGORY).map((categoryKey) => {
      const stored = inForce.find((entry) => entry.categoryKey === categoryKey);
      const counts = switchOffs.get(categoryKey);
      return {
        categoryKey,
        mandatory: MANDATORY_NOTIFICATION_CATEGORIES.has(categoryKey),
        addressNotice: ADDRESS_NOTICE_CATEGORIES.has(categoryKey),
        inForce:
          stored === undefined
            ? null
            : {
                behaviour: readNotificationCategory(stored.payload),
                revision: stored.revision,
                publishedAt: stored.publishedAt,
                publishedBy: stored.publishedBy,
                // Revisions are sequential per slot, so the one before is `revision - 1` wherever the store holds it.
                previousRevision: stored.previousPayload === null ? null : stored.revision - 1,
                previousBehaviour: stored.previousPayload === null ? null : readNotificationCategory(stored.previousPayload),
              },
        switchOffs: {
          byChannel: {
            [NOTIFICATION_CHANNEL.IN_APP]: counts?.byChannel.in_app ?? 0,
            [NOTIFICATION_CHANNEL.EMAIL]: counts?.byChannel.email ?? 0,
          },
          people: counts?.people ?? 0,
        },
      };
    });
  }
}

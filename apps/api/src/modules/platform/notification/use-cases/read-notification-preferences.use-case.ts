import { offeredPreferences } from '../domain/offered-preferences';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { NotificationPreferenceStore } from '../interfaces/notification-preference-store.interface';
import type { CategoryPreferences } from '../models/notification-preference.model';

/**
 * UC-168's read — every category the person can receive, on the channels it would reach them by, each on unless they
 * switched it off, and the mandatory ones locked on (task 52.1; FR-9, FR-163).
 *
 * **Asked of the catalogue on every read**, so a category published from A-17 (task 67.10) appears here with no
 * redeploy, on the channels it now travels on.
 */
export class ReadNotificationPreferences {
  constructor(
    private readonly store: NotificationPreferenceStore,
    private readonly categories: NotificationCategoryBehaviours,
  ) {}

  async execute(query: ReadNotificationPreferencesQuery): Promise<readonly CategoryPreferences[]> {
    return offeredPreferences({
      behaviourOf: (categoryKey) => this.categories.behaviourOf({ categoryKey }),
      switchedOff: await this.store.switchedOff(query),
    });
  }
}

export interface ReadNotificationPreferencesQuery {
  readonly accountId: string;
}

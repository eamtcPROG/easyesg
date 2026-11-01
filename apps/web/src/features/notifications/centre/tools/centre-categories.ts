import { NOTIFICATION_CHANNEL, type NotificationCategoryKey, type NotificationPreferences } from '@easyesg/contracts';

/** One choice of S-26's category filter: the key the address carries, and the name the reader is shown. */
export interface CentreCategory {
  readonly key: NotificationCategoryKey;
  readonly name: string;
}

/**
 * The categories S-26 filters on (task 37.3; §12.5.6's task-50.2 row (7), task-37.3/37.4 row (7)) — every category the
 * person can receive that **travels in-app**, since only those reach a centre, named as S-27 names them.
 *
 * **From the person's preferences, not a list in this app**, because which channels a category travels on is
 * configuration an operator changes from A-17: a category published in-app tomorrow is offered here with no release.
 * Whether the person switched it off is not asked — a notice that arrived before the switch-off is still in the
 * centre. **A category with no name written is left out**, since a choice the reader cannot read is no choice.
 *
 * **Fewer than two is none**: a filter over one category filters nothing (row (4)), so the heading draws no filter
 * until a second category can reach the centre.
 */
export function centreCategories(preferences: NotificationPreferences): readonly CentreCategory[] {
  const offered = preferences.categories.flatMap((category) =>
    category.categoryName !== undefined &&
    category.channels.some(({ channel }) => channel === NOTIFICATION_CHANNEL.IN_APP)
      ? [{ key: category.categoryKey, name: category.categoryName }]
      : [],
  );
  return offered.length < 2 ? [] : offered;
}

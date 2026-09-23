import { offeredPreferences, pairKey, switchablePairs } from '../domain/offered-preferences';
import { NotificationPreferenceNotOfferedError } from '../errors/notification.errors';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { NotificationPreferenceStore } from '../interfaces/notification-preference-store.interface';
import type { CategoryPreferences, NotificationPreferencePair } from '../models/notification-preference.model';

/**
 * UC-168's write — S-27's save: the pairs the person switched off, replacing what they had (task 52.1; FR-163,
 * BR-NOT-2; §12.5.6's task-52.1 row (4)).
 *
 * **Only what the read offers may change.** A pair it does not offer — a mandatory category above all — refuses the
 * whole write, so a mandatory category cannot be disabled by any client, not merely by S-27's not drawing the switch.
 * A stored switch-off the read no longer offers, for a channel the category stopped travelling on, is left as it
 * stands and holds again when the channel returns.
 *
 * **Answers the read as it now stands**, so a Record's save redraws from what was kept rather than from what was
 * sent.
 */
export class SetNotificationPreferences {
  constructor(
    private readonly store: NotificationPreferenceStore,
    private readonly categories: NotificationCategoryBehaviours,
  ) {}

  async execute(command: SetNotificationPreferencesCommand): Promise<readonly CategoryPreferences[]> {
    const behaviourOf = (categoryKey: NotificationPreferencePair['categoryKey']) =>
      this.categories.behaviourOf({ categoryKey });
    const offered = switchablePairs(offeredPreferences({ behaviourOf, switchedOff: [] }));
    const offeredKeys = new Set(offered.map(pairKey));

    if (!command.switchedOff.every((pair) => offeredKeys.has(pairKey(pair)))) {
      throw new NotificationPreferenceNotOfferedError();
    }

    // The same pair twice is the same switch-off, not a second one.
    const switchedOff = [...new Map(command.switchedOff.map((pair) => [pairKey(pair), pair])).values()];
    await this.store.replace({ accountId: command.accountId, offered, switchedOff });

    return offeredPreferences({ behaviourOf, switchedOff: await this.store.switchedOff(command) });
  }
}

export interface SetNotificationPreferencesCommand {
  readonly accountId: string;
  readonly switchedOff: readonly NotificationPreferencePair[];
}

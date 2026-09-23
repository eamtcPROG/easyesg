import {
  MANDATORY_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY,
  OPERATOR_NOTIFICATION_CATEGORIES,
  type NotificationCategoryKey,
} from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import type { CategoryPreferences, NotificationPreferencePair } from '../models/notification-preference.model';
import { dispatchChannels } from './dispatch-channels';

/**
 * What S-27 offers a person: every category a tenant account can receive, on the channels dispatch would use for
 * it, each switched on unless the person switched it off (task 52.1; FR-163, BR-NOT-2; §12.5.6's task-52.1 row (3)).
 *
 * **The channels are `dispatchChannels`' answer, not the artefact's**, so the read and the send cannot disagree: an
 * optional category whose behaviour cannot be read goes out on nothing and is not listed, and a mandatory one whose
 * artefact is unreadable is listed on the email floor it would be sent by.
 *
 * **A mandatory category is listed on and locked** whatever is stored — a stored switch-off for one could only come
 * from a category later made mandatory, and it must not read as honoured.
 */
export const offeredPreferences = (input: {
  readonly behaviourOf: (categoryKey: NotificationCategoryKey) => NotificationCategoryBehaviour | null;
  readonly switchedOff: readonly NotificationPreferencePair[];
}): readonly CategoryPreferences[] => {
  const off = new Set(input.switchedOff.map(pairKey));

  return RECEIVABLE_CATEGORIES.flatMap((categoryKey) => {
    const mandatory = MANDATORY_NOTIFICATION_CATEGORIES.has(categoryKey);
    const channels = dispatchChannels({ behaviour: input.behaviourOf(categoryKey), mandatory });
    if (channels === null) return [];

    return [
      {
        categoryKey,
        mandatory,
        channels: channels.map((channel) => ({
          channel,
          enabled: mandatory || !off.has(pairKey({ categoryKey, channel })),
        })),
      },
    ];
  });
};

/** The pairs a person may switch — every channel of every listed category that is not mandatory. */
export const switchablePairs = (offered: readonly CategoryPreferences[]): readonly NotificationPreferencePair[] =>
  offered
    .filter((category) => !category.mandatory)
    .flatMap((category) => category.channels.map(({ channel }) => ({ categoryKey: category.categoryKey, channel })));

/** One spelling of a pair's identity, for set membership — never stored and never on the wire. */
export const pairKey = (pair: NotificationPreferencePair): string => `${pair.categoryKey} ${pair.channel}`;

/** Every category a tenant account can receive, in the vocabulary's order — which is the order S-27 lists them. */
const RECEIVABLE_CATEGORIES: readonly NotificationCategoryKey[] = Object.values(NOTIFICATION_CATEGORY).filter(
  (categoryKey) => !OPERATOR_NOTIFICATION_CATEGORIES.has(categoryKey),
);

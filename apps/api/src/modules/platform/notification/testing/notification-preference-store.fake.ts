import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { isNotificationCategoryKey, NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { pairKey } from '../domain/offered-preferences';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type {
  NotificationPreferenceStore,
  ReplaceNotificationPreferencesCommand,
} from '../interfaces/notification-preference-store.interface';
import type { UnsubscribeTokens } from '../interfaces/unsubscribe-tokens.interface';
import {
  isNotificationChannel,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type NotificationChannel,
} from '../models/notification-category.model';
import type { NotificationPreferencePair } from '../models/notification-preference.model';

/**
 * `NotificationPreferenceStore`'s contract, modelled rather than stubbed (task 52.1): `replace` changes only the
 * offered pairs and leaves the rest — the half of §12.5.6's task-52.1 row (4) a return-value stub could not show.
 */
export class FakeNotificationPreferenceStore implements NotificationPreferenceStore {
  readonly replaced: ReplaceNotificationPreferencesCommand[] = [];

  constructor(private rows: NotificationPreferencePair[] = []) {}

  switchedOff(): Promise<readonly NotificationPreferencePair[]> {
    return Promise.resolve([...this.rows]);
  }

  switchOff(command: { readonly pair: NotificationPreferencePair }): Promise<void> {
    if (!this.rows.some((row) => pairKey(row) === pairKey(command.pair))) this.rows.push(command.pair);
    return Promise.resolve();
  }

  replace(command: ReplaceNotificationPreferencesCommand): Promise<void> {
    this.replaced.push(command);
    const offered = new Set(command.offered.map(pairKey));
    this.rows = [...this.rows.filter((row) => !offered.has(pairKey(row))), ...command.switchedOff];
    return Promise.resolve();
  }
}

/** The seed's categories, with the reminder travelling on the channels given and every other by email alone. */
export const reminderTravellingOn = (...channels: NotificationChannel[]): NotificationCategoryBehaviours => ({
  behaviourOf: ({ categoryKey }) =>
    categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER
      ? { channels, classification: NOTIFICATION_CLASSIFICATION.OPTIONAL }
      : { channels: [NOTIFICATION_CHANNEL.EMAIL], classification: NOTIFICATION_CLASSIFICATION.TRANSACTIONAL },
});

export const REMINDER_IN_APP: NotificationPreferencePair = {
  categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
  channel: NOTIFICATION_CHANNEL.IN_APP,
};

export const REMINDER_EMAIL: NotificationPreferencePair = {
  categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
  channel: NOTIFICATION_CHANNEL.EMAIL,
};

/** What stands in for a signature: a token without it is one nobody signed. */
const PLAIN_SIGNATURE = 'signed';

/**
 * `UnsubscribeTokens` with no cryptography: a token is its subject spelled out, and anything else reads as unsigned.
 * The signature is `HmacUnsubscribeTokens`' spec; the use cases' specs are about what a subject may switch off.
 */
export const plainTokens: UnsubscribeTokens = {
  sign: (subject) => `${PLAIN_SIGNATURE}:${subject.accountId}:${subject.categoryKey}:${subject.channel}`,
  read: (token) => {
    const [marker, accountId, categoryKey, channel] = token.split(':');
    return marker === PLAIN_SIGNATURE && isNotificationCategoryKey(categoryKey) && isNotificationChannel(channel)
      ? { accountId, categoryKey, channel }
      : null;
  },
};

/** The accounts that exist, by id, each at its address — the recipients port a followed link names its reader from. */
export const accountsAt = (addresses: Readonly<Record<string, string>>): NotificationRecipientsPort => ({
  resolve: ({ userIds }) =>
    Promise.resolve(
      userIds.flatMap((userId) =>
        addresses[userId] === undefined ? [] : [{ userId, email: addresses[userId], locale: 'ro' as const }],
      ),
    ),
});

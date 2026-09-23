import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { pairKey } from '../domain/offered-preferences';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type {
  NotificationPreferenceStore,
  ReplaceNotificationPreferencesCommand,
} from '../interfaces/notification-preference-store.interface';
import {
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

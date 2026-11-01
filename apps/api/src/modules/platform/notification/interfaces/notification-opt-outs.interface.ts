import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * Who, among a notice's recipients, switched its category off — and on which channel (task 52.2.1; FR-163;
 * §12.5.6's task-52.2 row (1)). Dispatch's one question of `notification.preference`, asked on the worker when the
 * notice is sent; the preferences' own read and write are `NotificationPreferenceStore`'s.
 */
export interface NotificationOptOuts {
  optedOut(query: {
    readonly categoryKey: NotificationCategoryKey;
    readonly accountIds: readonly string[];
  }): Promise<readonly OptedOutRecipient[]>;
}

export interface OptedOutRecipient {
  readonly accountId: string;
  readonly channel: NotificationChannel;
}

export const NOTIFICATION_OPT_OUTS = Symbol('NOTIFICATION_OPT_OUTS');

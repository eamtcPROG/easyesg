import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationChannel } from './notification-category.model';

/**
 * A person's notification preferences (task 52.1; UC-168, FR-9, FR-163; §12.5.6's task-52.1 row).
 *
 * **What is stored is a switch-off**, one `(category, channel)` pair per row: a pair with no row is on. So a channel
 * a category gains later arrives switched on, and a person who never opened S-27 holds no rows at all.
 */

/** One channel of one category — the unit a person switches, and the unit stored. */
export interface NotificationPreferencePair {
  readonly categoryKey: NotificationCategoryKey;
  readonly channel: NotificationChannel;
}

/** One channel of a listed category, as the read offers it. */
export interface ChannelPreference {
  readonly channel: NotificationChannel;
  /** Always `true` on a mandatory category, which nobody may switch off. */
  readonly enabled: boolean;
}

/** One category a tenant account can receive, on the channels dispatch would use for it. */
export interface CategoryPreferences {
  readonly categoryKey: NotificationCategoryKey;
  /** FR-163's *non-suppressible*: listed switched on and locked, never offered as a switch. */
  readonly mandatory: boolean;
  /** Never empty: a category that would travel on nothing is not listed. */
  readonly channels: readonly ChannelPreference[];
}

/** A listed category in the request's language: its name beside it, absent where none is written. */
export interface CategoryPreferencesItem extends CategoryPreferences {
  readonly categoryName?: string;
}

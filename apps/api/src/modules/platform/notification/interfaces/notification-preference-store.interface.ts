import type { NotificationPreferencePair } from '../models/notification-preference.model';

/**
 * Where a person's switch-offs are kept (task 52.1; FR-163; §12.5.6's task-52.1 rows (1), (4)).
 *
 * **Keyed by the account and nothing else**: a preference follows the person across organizations, so there is no
 * tenant to bind, and the account is always the session's — no caller may name another.
 */
export interface NotificationPreferenceStore {
  /** Every pair the account has switched off, whether or not the read offers it today. */
  switchedOff(query: { readonly accountId: string }): Promise<readonly NotificationPreferencePair[]>;
  /**
   * Makes `switchedOff` the account's switch-offs **among the `offered` pairs**, in one transaction, and leaves every
   * other stored pair as it stands. A pair already off keeps the time it was first switched off.
   */
  replace(command: ReplaceNotificationPreferencesCommand): Promise<void>;
}

export interface ReplaceNotificationPreferencesCommand {
  readonly accountId: string;
  /** The pairs the read offers — the only ones this write may change. */
  readonly offered: readonly NotificationPreferencePair[];
  /** A subset of `offered`, which the use case has already checked. */
  readonly switchedOff: readonly NotificationPreferencePair[];
}

export const NOTIFICATION_PREFERENCE_STORE = Symbol('NOTIFICATION_PREFERENCE_STORE');

import type { components } from './generated/v1';
import type { SameSet } from './same-set';

/**
 * FR-169's one-click unsubscribe (task 52.2.2) — the api's `UNSUBSCRIBE_STANDING`
 * (`src/modules/platform/notification/models/unsubscribe.model.ts`), mirrored for S-38, which draws one arm per
 * standing and cannot branch on wording. A copy changed with its source by hand, for `PROBLEM_TYPE`'s reason, and
 * **held to the generated enum at compile time** as `SUPPORT_ACCESS_STATE` is.
 */
export const UNSUBSCRIBE_STANDING = {
  /** The category still reaches the person by email, and the link can switch it off. */
  AVAILABLE: 'available',
  /** It no longer does — from this link before, or from the profile. */
  SWITCHED_OFF: 'switched_off',
  /** The link can switch nothing off. */
  UNUSABLE: 'unusable',
} as const;

export type UnsubscribeStanding = (typeof UNSUBSCRIBE_STANDING)[keyof typeof UNSUBSCRIBE_STANDING];

export const UNSUBSCRIBE_STANDING_MIRRORS_WIRE: SameSet<
  UnsubscribeStanding,
  components['schemas']['UnsubscribeResponseDto']['standing']
> = true;

/**
 * The notification categories this release raises (task 67.10) — the api's `NOTIFICATION_CATEGORY`
 * (`src/contracts/notification.port.ts`), mirrored for A-17 and A-08, which name each category in the console's own words:
 * an address notice carries no in-app name to show. A key to act on, never text; held to the wire like the rest.
 */
export const NOTIFICATION_CATEGORY = {
  EMAIL_VERIFICATION: 'identity.email_verification',
  PASSWORD_RESET: 'identity.password_reset',
  INVITATION: 'identity.invitation',
  ADMIN_INVITATION: 'platform.admin_invitation',
  MANUAL_REMINDER: 'reporting.manual_reminder',
} as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

const CATEGORY_KEYS: readonly string[] = Object.values(NOTIFICATION_CATEGORY);

/** Whether an unvalidated value — a search parameter, say — names a category. Beside the vocabulary it narrows to. */
export const isNotificationCategoryKey = (value: unknown): value is NotificationCategoryKey =>
  typeof value === 'string' && CATEGORY_KEYS.includes(value);

export const NOTIFICATION_CATEGORY_MIRRORS_WIRE: SameSet<
  NotificationCategoryKey,
  components['schemas']['ConsoleCategoryResponseDto']['categoryKey']
> = true;

/** Where a category travels (task 67.10) — the api's `NOTIFICATION_CHANNEL`, one checkbox each on A-17. */
export const NOTIFICATION_CHANNEL = { IN_APP: 'in_app', EMAIL: 'email' } as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_CHANNEL_MIRRORS_WIRE: SameSet<
  NotificationChannel,
  components['schemas']['CategoryBehaviourRequestDto']['channels'][number]
> = true;

/** Whether a recipient may switch a category off (task 67.10; FR-163) — the api's `NOTIFICATION_CLASSIFICATION`. */
export const NOTIFICATION_CLASSIFICATION = { TRANSACTIONAL: 'transactional', OPTIONAL: 'optional' } as const;

export type NotificationClassification = (typeof NOTIFICATION_CLASSIFICATION)[keyof typeof NOTIFICATION_CLASSIFICATION];

export const NOTIFICATION_CLASSIFICATION_MIRRORS_WIRE: SameSet<
  NotificationClassification,
  components['schemas']['CategoryBehaviourRequestDto']['classification']
> = true;

/**
 * What a publication changes for recipients (task 67.10; UX-123's scope disclosure) — the api's
 * `PUBLICATION_CONSEQUENCE`, which A-17 words one sentence per kind.
 */
export const CATEGORY_CONSEQUENCE = {
  SWITCH_OFFS_OVERRIDDEN: 'switch_offs_overridden',
  BECOMES_SWITCHABLE: 'becomes_switchable',
  CHANNEL_REMOVED: 'channel_removed',
  CHANNEL_ADDED: 'channel_added',
} as const;

export type CategoryConsequenceKind = (typeof CATEGORY_CONSEQUENCE)[keyof typeof CATEGORY_CONSEQUENCE];

export const CATEGORY_CONSEQUENCE_MIRRORS_WIRE: SameSet<
  CategoryConsequenceKind,
  components['schemas']['CategoryConsequenceResponseDto']['kind']
> = true;

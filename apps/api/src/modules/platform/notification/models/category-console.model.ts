import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour, NotificationChannel } from './notification-category.model';

/**
 * A-17's view of the category catalogue (task 67.10; UC-176, FR-173; §12.5.6's task-67.10 row).
 */

/** One category as the console reads it: what code declares about it, and what is in force. */
export interface ConsoleCategory {
  readonly categoryKey: NotificationCategoryKey;
  /** Code's `MANDATORY_NOTIFICATION_CATEGORIES`: classification fixed, email required. */
  readonly mandatory: boolean;
  /** Code's `ADDRESS_NOTICE_CATEGORIES`: in-app refused. */
  readonly addressNotice: boolean;
  /** `null` where nothing is in force — a category whose artefact was never published. */
  readonly inForce: CategoryInForce | null;
  /** How many people switched it off, per channel and in all — what a publication's disclosure counts. */
  readonly switchOffs: SwitchOffCounts;
}

export interface CategoryInForce {
  /** `null` where the artefact in force cannot be read — the catalogue's fail-closed answer, shown as such. */
  readonly behaviour: NotificationCategoryBehaviour | null;
  readonly revision: number;
  readonly publishedAt: Date | null;
  /** The publishing operator's address; `null` for a seeded revision, which no operator published. */
  readonly publishedBy: string | null;
  /** The revision a one-step revert would restore, where there is one. */
  readonly previousRevision: number | null;
  /**
   * What that revert would put in force, so the console can preview it as it previews a publication (UX-123) — `null`
   * where there is no previous revision or it cannot be read, which the revert refuses as nothing to revert to.
   */
  readonly previousBehaviour: NotificationCategoryBehaviour | null;
}

export interface SwitchOffCounts {
  readonly byChannel: Readonly<Record<NotificationChannel, number>>;
  /** Distinct people with a switch-off on any channel. */
  readonly people: number;
}

/**
 * Why A-17 refuses a behaviour (§12.5.6's task-67.10 row) — each a rule code declares, never an operator's to override.
 */
export const PUBLICATION_REFUSAL = {
  /** A mandatory category is transactional, whatever is published. */
  MANDATORY_CLASSIFICATION: 'mandatory_classification',
  /** A mandatory category travels by email — without it a verification link would go nowhere. */
  MANDATORY_WITHOUT_EMAIL: 'mandatory_without_email',
  /** An address notice's token-carrying link has no use in a centre. */
  ADDRESS_NOTICE_IN_APP: 'address_notice_in_app',
  /** A channel whose wording a catalogue does not carry — `renderEmail` would throw at the send. */
  WORDING_MISSING: 'wording_missing',
} as const;

export type PublicationRefusal = (typeof PUBLICATION_REFUSAL)[keyof typeof PUBLICATION_REFUSAL];

/**
 * What a publication changes for recipients — UX-123's scope disclosure for a category (task 67.10 row (2)). A list,
 * since one change can do several things.
 */
export const PUBLICATION_CONSEQUENCE = {
  /** Optional made transactional: these people's switch-offs stop counting, and it reaches them again. */
  SWITCH_OFFS_OVERRIDDEN: 'switch_offs_overridden',
  /** Transactional made optional: recipients may switch it off on S-27 and from its emails. */
  BECOMES_SWITCHABLE: 'becomes_switchable',
  /** A channel it will no longer travel on — nobody receives it there. */
  CHANNEL_REMOVED: 'channel_removed',
  /** A channel it will travel on — everyone it reaches, except those who switched it off there before. */
  CHANNEL_ADDED: 'channel_added',
} as const;

export type PublicationConsequenceKind = (typeof PUBLICATION_CONSEQUENCE)[keyof typeof PUBLICATION_CONSEQUENCE];

export type PublicationConsequence =
  | { readonly kind: typeof PUBLICATION_CONSEQUENCE.SWITCH_OFFS_OVERRIDDEN; readonly people: number }
  | { readonly kind: typeof PUBLICATION_CONSEQUENCE.BECOMES_SWITCHABLE }
  | { readonly kind: typeof PUBLICATION_CONSEQUENCE.CHANNEL_REMOVED; readonly channel: NotificationChannel }
  | {
      readonly kind: typeof PUBLICATION_CONSEQUENCE.CHANNEL_ADDED;
      readonly channel: NotificationChannel;
      /** People who switched it off on this channel before, whose choice holds again (task 52.1 row (4)). */
      readonly stayingOff: number;
    };

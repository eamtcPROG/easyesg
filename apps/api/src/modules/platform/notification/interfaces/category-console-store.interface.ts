import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour, NotificationChannel } from '../models/notification-category.model';

/**
 * A-17's store (task 67.10) — the category artefacts over the configuration store's own tables, and the switch-offs
 * a publication's disclosure counts.
 *
 * **Read from the tables, not the store's cache**, the task-67.11 row's reason: the cache carries no publisher and may be
 * a poll behind, and an editor that published against a stale revision would be refused for a change it could not see.
 */
export interface CategoryConsoleStore {
  /** Every category artefact in force, with its payload as stored and who put it there. */
  inForce(): Promise<readonly StoredCategory[]>;
  /** A revision's payload as stored; `null` for a revision that does not exist. */
  payloadAt(query: { readonly categoryKey: NotificationCategoryKey; readonly revision: number }): Promise<Record<string, unknown> | null>;
  /** Per category: people with a switch-off on each channel, and in all. */
  switchOffs(): Promise<ReadonlyMap<NotificationCategoryKey, StoredSwitchOffs>>;
  /** Publishes against the revision read; `CategoryChangedError` when another is in force. */
  publish(command: CategoryPublicationCommand): Promise<{ readonly id: string; readonly revision: number }>;
}

export interface StoredCategory {
  readonly categoryKey: NotificationCategoryKey;
  readonly revision: number;
  readonly payload: Record<string, unknown>;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  /** The revision before it, as stored — what a one-step revert restores; `null` where there is none. */
  readonly previousPayload: Record<string, unknown> | null;
}

export interface StoredSwitchOffs {
  readonly byChannel: Partial<Record<NotificationChannel, number>>;
  readonly people: number;
}

export interface CategoryPublicationCommand {
  readonly categoryKey: NotificationCategoryKey;
  readonly behaviour: NotificationCategoryBehaviour;
  /** The revision the change was made against — `0` for a category with nothing in force. */
  readonly expectedRevision: number;
  /** The publishing operator, the version's `created_by`. */
  readonly operatorId: string;
}

export const CATEGORY_CONSOLE_STORE = Symbol('CATEGORY_CONSOLE_STORE');

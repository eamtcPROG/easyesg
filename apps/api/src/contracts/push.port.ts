/**
 * AD-15's hints, as the api declares them (task 148; §12.5.6's task-148 row).
 *
 * **A second copy of `packages/contracts`' event catalogue, on purpose and gated.** The api produces the wire contract
 * and may not import it (`api-not-to-contracts-package`), so the event names and their audiences are declared here as
 * well, and `pnpm events:check` fails when this map and the catalogue disagree — the shape `PROBLEM_TYPE` already has.
 * **No runtime import**: the checker loads this file directly under Node's type stripping.
 *
 * Two ports, one per side of the outbox, so a producer never chooses how its hint travels:
 *
 * - `PUSH_HINTS` — the request tier's. It writes an outbox row on the caller's own transaction, so a hint commits with
 *   the change it announces or not at all, and the worker publishes it only once that change is visible.
 * - `PUSH_PUBLISHER` — the worker's. It publishes to Redis at once, for a change the worker itself just wrote.
 */

/** The events a hint may name — `packages/contracts`' catalogue, mirrored. */
export const PUSH_EVENT = {
  /** S-16's access list changed: an invitation issued, resent, revoked or accepted, a member's role or removal. */
  ACCESS_CHANGED: 'access.changed',
  /** A person's unread count changed: a notice delivered in-app, read, dismissed, all marked read, or cancelled. */
  NOTIFICATION_UNREAD_CHANGED: 'notification.unread_changed',
} as const;

export type PushEvent = (typeof PUSH_EVENT)[keyof typeof PUSH_EVENT];

/** Who a hint reaches — the catalogue's routing keys (§12.5.6's task-146 row (1)). */
export const PUSH_ROUTING = {
  ORGANIZATION: 'organization',
  ACCOUNT: 'account',
} as const;

export type PushRouting = (typeof PUSH_ROUTING)[keyof typeof PUSH_ROUTING];

/** Each event's audience — the map `events:check` holds equal to the catalogue. */
export const PUSH_EVENT_ROUTING = {
  [PUSH_EVENT.ACCESS_CHANGED]: PUSH_ROUTING.ORGANIZATION,
  [PUSH_EVENT.NOTIFICATION_UNREAD_CHANGED]: PUSH_ROUTING.ACCOUNT,
} as const satisfies Record<PushEvent, PushRouting>;

type RoutedBy<R extends PushRouting> = {
  [E in PushEvent]: (typeof PUSH_EVENT_ROUTING)[E] extends R ? E : never;
}[PushEvent];

/**
 * A hint, shaped by its event's audience — **an account-routed one must name its accounts**, and an
 * organization-routed one may not, so a producer cannot send either to the wrong audience and compile.
 */
export type PushHintCommand =
  | { readonly event: RoutedBy<typeof PUSH_ROUTING.ORGANIZATION>; readonly organizationId: string }
  | {
      readonly event: RoutedBy<typeof PUSH_ROUTING.ACCOUNT>;
      readonly organizationId: string;
      readonly accountIds: readonly string[];
    };

/** The request tier's: an outbox row on the caller's own transaction. */
export interface PushHints {
  hint(command: PushHintCommand): Promise<void>;
}

/** The worker's: published at once, `since` defaulting to now — the change it announces is already written. */
export interface PushPublisher {
  publish(command: PushHintCommand & { readonly since?: Date }): Promise<void>;
}

export const PUSH_HINTS = Symbol('PUSH_HINTS');
export const PUSH_PUBLISHER = Symbol('PUSH_PUBLISHER');

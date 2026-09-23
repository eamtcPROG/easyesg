import type { paths } from '../generated/v1';

/**
 * The event catalogue — AD-15's second contract (task 146; §12.5.6's task-146 row).
 *
 * A pushed frame is a **contentless hint** — `{event, organizationId, since}` — whose only effect is to make a screen
 * run the read it was already entitled to run, sooner than its poll would. **Every event names that read**, its
 * `authority`: the HTTP path the client refetches, which is the answer the frame only hurries along. That link is the
 * machine-checkable form of *push is never the authority*, and it is the reason this is not AsyncAPI, whose generated
 * artefact cannot express it.
 *
 * **Two gates hold it** (`pnpm events:check`, `tools/check-events.mjs`): the catalogue is emitted to
 * `events/v1.json` and diffed against the committed copy, as `openapi:check` does for paths, so an event added here
 * and not committed there fails; and every authority must be a path in `openapi/v1.json` that answers a GET, so an
 * event cannot point at a read the contract does not serve.
 *
 * **One module, with no relative import that survives compilation**, because the checker loads this file directly
 * under Node's type stripping, which resolves no extensionless relative specifier. The one import is `import type`,
 * erased before Node sees it.
 *
 * **The first two events arrived with task 148** (§12.5.6's task-148 row): the gate existed before them, on task 3's
 * precedent, so they met it. **The api declares them again** in its port surface (`apps/api/src/contracts/push.port.ts`),
 * since it may not import this package, and `events:check` fails when the two copies disagree.
 */

/**
 * Who receives an event's hint — its audience, the gateway's subscription and never the frame's content (§12.5.6's
 * task-146 row (1)). One audience per event.
 */
export const EVENT_ROUTING_KEY = {
  /** Every connection bound to the organization the frame names. */
  ORGANIZATION: 'organization',
  /** Only the connections of the account the event concerns. */
  ACCOUNT: 'account',
} as const;

export type EventRoutingKey = (typeof EVENT_ROUTING_KEY)[keyof typeof EVENT_ROUTING_KEY];

/**
 * The contract's paths that answer a GET — the only kind an event may name (§12.5.6's task-146 row (2)). A frame's
 * effect is a refetch, and a path that only writes cannot be refetched. openapi-typescript writes an absent method as
 * an optional `never`, which a required `get` does not match.
 */
export type ReadablePath = { [P in keyof paths]: paths[P] extends { get: object } ? P : never }[keyof paths];

export interface EventCatalogueEntry {
  /** The event's name, as the frame's `event` carries it. */
  readonly name: string;
  readonly routingKey: EventRoutingKey;
  /** The read the hint hurries — the authority the screen refetches. */
  readonly authority: ReadablePath;
}

/**
 * The events' names, as a vocabulary a client compares against (task 149) — declared once here and read by each entry
 * below, so a surface subscribing to an event names a member rather than restating its spelling.
 */
export const EVENT_NAME = {
  /** S-16's list of members and invitations changed — any write that changes `GET /access`'s answer. */
  ACCESS_CHANGED: 'access.changed',
  /** A person's unread count changed — an in-app notice delivered, read, dismissed, all marked read, or withdrawn. */
  NOTIFICATION_UNREAD_CHANGED: 'notification.unread_changed',
} as const;

export const EVENT_CATALOGUE = [
  { name: EVENT_NAME.ACCESS_CHANGED, routingKey: EVENT_ROUTING_KEY.ORGANIZATION, authority: '/api/v1/access' },
  {
    name: EVENT_NAME.NOTIFICATION_UNREAD_CHANGED,
    routingKey: EVENT_ROUTING_KEY.ACCOUNT,
    authority: '/api/v1/notifications/unread-count',
  },
] as const satisfies readonly EventCatalogueEntry[];

/** The name of an event the catalogue declares. */
export type EventName = (typeof EVENT_CATALOGUE)[number]['name'];

const EVENT_NAMES: ReadonlySet<string> = new Set(EVENT_CATALOGUE.map((entry) => entry.name));

/** Whether an unvalidated string — a received frame's `event` — is an event the catalogue declares (task 149). */
export const isEventName = (value: string): value is EventName => EVENT_NAMES.has(value);

/**
 * **The frame a browser receives — exactly three fields, and no tenant data** (AD-15's first constraint; §12.5.6's
 * task-148 row). Its only effect is to make the screen refetch its authority, sooner than its poll would. `since` is
 * when the change was made, in epoch milliseconds; `organizationId` is what lets a client showing another
 * organization ignore it. `event-frame.proof.ts` fails `typecheck` if a field is added.
 */
export interface EventFrame {
  readonly event: EventName;
  readonly organizationId: string;
  readonly since: number;
}

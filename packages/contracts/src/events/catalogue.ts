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
 * **Zero events**, on task 3's precedent: the gate exists before the first entry, so the first entry meets it.
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

export const EVENT_CATALOGUE = [] as const satisfies readonly EventCatalogueEntry[];

/** The name of an event the catalogue declares — none yet, so nothing can be published. */
export type EventName = (typeof EVENT_CATALOGUE)[number]['name'];

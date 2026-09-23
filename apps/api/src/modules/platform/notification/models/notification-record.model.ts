/**
 * The notice's own state, and what each delivery of it came to (task 50.1.1; §12.5.6's task-50.1 row (4), (7)).
 *
 * Both mirror the `CHECK` constraints in `1790467200000-notification-store.ts` — the database's own copy of each
 * vocabulary, which a migration keeps literal — so a member changes in both places or in neither.
 */

/**
 * `raised` once recorded, `delivered` once a dispatch of it has finished, `cancelled` when its condition cleared
 * (FR-167, task 50.1.3). **Read is not here**: it is each recipient's, on their in-app delivery (FR-161).
 */
export const NOTIFICATION_STATE = {
  RAISED: 'raised',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type NotificationState = (typeof NOTIFICATION_STATE)[keyof typeof NOTIFICATION_STATE];

/**
 * FR-170's outcome. In-app is `delivered` the moment its row is written — the centre is the store (FR-168); an
 * email is `accepted` when the provider takes it.
 *
 * **Two of these are terminal and neither retries** (task 51.4; §12.5.6's task-51.4 row): `bounced` is a send the
 * provider refused outright, `suppressed` one this platform declined to attempt because the address had already
 * bounced. Mirrors `delivery_outcome_known`, which is the database's own copy — the two change together by hand.
 *
 * **There is deliberately no `failed`.** A transient failure that exhausts NFR-107's attempts leaves no row to
 * mark, since a row is written only once the provider accepts; the job lands in BullMQ's failed set instead.
 */
export const DELIVERY_OUTCOME = {
  DELIVERED: 'delivered',
  ACCEPTED: 'accepted',
  BOUNCED: 'bounced',
  SUPPRESSED: 'suppressed',
  /**
   * The recipient switched the category off on this channel, so nothing was sent (task 52.2.1; FR-163, FR-170). Not
   * `suppressed`, which is a dead address: this is a person's choice, and it is theirs to reverse.
   */
  OPTED_OUT: 'opted_out',
} as const;

export type DeliveryOutcome = (typeof DELIVERY_OUTCOME)[keyof typeof DELIVERY_OUTCOME];

/**
 * The organization a notice that belongs to none is recorded under — an account's verification or reset, an
 * operator's invitation (task 50.1.4; §12.5.6's task-50.1 row (17)). The nil UUID, which `core.organization` refuses
 * to any organization by `CHECK`, so the worker binds it for a platform notice and the tenant tier, binding only an
 * account's real memberships, never can. Mirrored literally in `1790726400000-address-notices.ts`.
 */
export const PLATFORM_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000000';

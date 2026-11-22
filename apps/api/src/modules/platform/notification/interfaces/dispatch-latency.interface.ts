import type { EpochMicros } from '@api/contracts/types/time';
import type { NotificationChannel } from '../models/notification-category.model';

/**
 * NFR-106's measurement, as the delivery flow sees it: a raised notice has just reached recipients on a channel (task
 * 202; §12.5.6's task-202 row (4)).
 *
 * **The flow says what happened and when the raise was; the adapter reads the clock and owns the instrument.** So the
 * use case names no metrics library (P-7, `domain-free-of-frameworks`), and the interval is taken at the moment the
 * call is made — after the delivery's row is written, which is where the flow calls it.
 *
 * **Synchronous, and it never fails a delivery**: a lost observation costs a point on a dashboard, and a delivery
 * failed for it would cost the notice.
 */
export interface DispatchLatency {
  dispatched(dispatch: RaisedDispatch): void;
}

/** One raise's deliveries on one channel, each of them a dispatch NFR-106 counts. */
export interface RaisedDispatch {
  readonly channel: NotificationChannel;
  /** The raise's own outbox row (`occurred_at`), never the notice's first raise: a folded raise is timed from itself. */
  readonly raisedAtMicros: EpochMicros;
  /** How many recipients this one write reached — one observation each, FR-170's row per recipient per channel. */
  readonly deliveries: number;
}

export const DISPATCH_LATENCY = Symbol('DISPATCH_LATENCY');

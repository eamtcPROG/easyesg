import { SOCKET_CLOSE } from '@easyesg/contracts';
import { ACCELERATED_POLL_INTERVAL, nextPollDelay } from '@/client/polling/poll-schedule';

/**
 * What the connection does once a socket is gone or could not be had (task 149; §12.5.6's task-149 row (3), (4)).
 *
 * **It retries, full-jitter exponential from the shortest accelerated interval to OQ-36's five-minute cap** — the same
 * `nextPollDelay` a failing poll backs off by. One socket serves every surface on the tab, so "the surface's own
 * interval" reads as the shortest of them; derived from the schedule, so a faster accelerated surface moves it. The
 * jitter is the point: across §13.3's manual failover every tab loses its socket at once, and a fixed wait would bring
 * them back at once too.
 *
 * **Or it parks until the tab is next shown**, when trying again would only repeat what happened: a socket superseded
 * by the account's eleventh connection (`4001`) — reopening at once would evict another tab, and eleven tabs would
 * evict each other in turn — a ticket the session is refused, and a close for a client frame, which this client never
 * sends. A replica shutting down (`1001`) and an abnormal drop — the code a refused upgrade also arrives as, since a
 * browser is told no status — retry.
 */
export const RECONNECT_BASE = Math.min(...Object.values(ACCELERATED_POLL_INTERVAL));

export const AFTER_LOSS = {
  RETRY: 'retry',
  PARK: 'park',
} as const;

export type AfterLoss =
  | { readonly kind: typeof AFTER_LOSS.RETRY; readonly delay: number }
  | { readonly kind: typeof AFTER_LOSS.PARK };

/** How a socket was lost, or never had. */
export const LOSS = {
  /** The session will not be given a ticket. */
  REFUSED: 'refused',
  /** The ticket could not be minted or read. */
  FAILED: 'failed',
  /** A socket closed, with the code it closed with. */
  CLOSED: 'closed',
} as const;

export type Loss =
  | { readonly kind: typeof LOSS.REFUSED | typeof LOSS.FAILED }
  | { readonly kind: typeof LOSS.CLOSED; readonly code: number };

/** Close codes after which the connection waits for the tab to be shown again. */
const PARKING_CODES: ReadonlySet<number> = new Set([SOCKET_CLOSE.SUPERSEDED, SOCKET_CLOSE.CLIENT_FRAME]);

const parks = (loss: Loss): boolean =>
  loss.kind === LOSS.REFUSED || (loss.kind === LOSS.CLOSED && PARKING_CODES.has(loss.code));

/** The decision after a loss. `losses` counts the consecutive ones, this included — reset when a socket opens. */
export const afterLoss = (input: {
  readonly loss: Loss;
  readonly losses: number;
  readonly random?: () => number;
}): AfterLoss => {
  if (parks(input.loss)) return { kind: AFTER_LOSS.PARK };
  return {
    kind: AFTER_LOSS.RETRY,
    delay: nextPollDelay({ interval: RECONNECT_BASE, failures: Math.max(1, input.losses), random: input.random }),
  };
};

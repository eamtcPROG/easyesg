import type { EpochMicros } from '@api/contracts/types/time';

/**
 * NFR-106's instrument: what one observation is, and the series it lands in (task 202; §12.5.6's task-202 row (4)).
 *
 * **Declared once for two readers that cannot import it**: the adapter writes the series by this name, and the recording
 * rules and the dashboard in `infra/compose/prometheus` and `infra/compose/grafana` read it by the same name.
 * `raise-to-dispatch.spec.ts` holds the files to it, so a rename here cannot leave a dashboard reading nothing.
 */
export const RAISE_TO_DISPATCH = {
  /**
   * The histogram's name as Prometheus stores it, with `_bucket`, `_sum` and `_count` beside it. The exporter does not
   * append the unit, so `_seconds` is spelled here, as Prometheus's naming asks.
   */
  name: 'easyesg_notification_raise_to_dispatch_seconds',
  unit: 's',
  description: 'Seconds from a notice being raised to its dispatch on one channel, one observation per recipient.',
  /**
   * Upper bounds, in seconds. **60 is NFR-106's threshold, exactly**, so the share of dispatches within it is counted
   * rather than interpolated — the exact reading of "p95 ≤ 60 s". Fine below it, where a healthy dispatch lands a
   * poll or two after its raise, and coarse above it out to 86 400 s, NFR-107's retry bound.
   */
  buckets: [0.5, 1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 300, 600, 1800, 3600, 7200, 21600, 86400],
  /** The one attribute an observation carries. No organization, category or person: the series hold nothing personal. */
  channelLabel: 'channel',
} as const;

/** NFR-106's bound on the 95th percentile, in the histogram's unit. */
export const NFR_106_THRESHOLD_SECONDS = 60;

/**
 * Seconds from a raise to now. The raise is the database's clock (the outbox row's transaction) and now is the
 * worker's, so a skew between them can make a near-instant dispatch read as negative — counted as zero rather than
 * dropped, since the dispatch happened and was fast.
 */
export const secondsSinceRaise = (input: { readonly raisedAtMicros: EpochMicros; readonly now: Date }): number =>
  Math.max(0, input.now.getTime() * 1000 - input.raisedAtMicros) / 1_000_000;

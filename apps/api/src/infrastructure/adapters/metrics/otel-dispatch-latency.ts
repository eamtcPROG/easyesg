import { Inject, Injectable } from '@nestjs/common';
import type { Histogram, Meter } from '@opentelemetry/api';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { METER } from '@api/infrastructure/observability/prometheus-metrics';
import type {
  DispatchLatency,
  RaisedDispatch,
} from '@api/modules/platform/notification/interfaces/dispatch-latency.interface';
import { RAISE_TO_DISPATCH, secondsSinceRaise } from './raise-to-dispatch';

/**
 * `DISPATCH_LATENCY` as an OpenTelemetry histogram (task 202; NFR-106, §12.5.6's task-202 row (4)) — the one place the
 * delivery flow's report becomes a metric, so no vendor type reaches the use case (P-7).
 *
 * **The clock is read here, at the call**, which the flow makes once a delivery's row is written: that moment is the
 * dispatch. One observation per delivery, labelled by channel alone.
 */
@Injectable()
export class OtelDispatchLatency implements DispatchLatency {
  private readonly histogram: Histogram;

  constructor(
    @Inject(METER) meter: Meter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.histogram = meter.createHistogram(RAISE_TO_DISPATCH.name, {
      unit: RAISE_TO_DISPATCH.unit,
      description: RAISE_TO_DISPATCH.description,
      advice: { explicitBucketBoundaries: [...RAISE_TO_DISPATCH.buckets] },
    });
  }

  dispatched(dispatch: RaisedDispatch): void {
    const seconds = secondsSinceRaise({ raisedAtMicros: dispatch.raisedAtMicros, now: this.clock() });
    for (let delivery = 0; delivery < dispatch.deliveries; delivery += 1) {
      this.histogram.record(seconds, { [RAISE_TO_DISPATCH.channelLabel]: dispatch.channel });
    }
  }
}

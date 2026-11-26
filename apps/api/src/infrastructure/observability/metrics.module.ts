import { Module } from '@nestjs/common';
import { METER, PrometheusMetrics } from './prometheus-metrics';

/**
 * The process's metrics, as a meter to create instruments from (task 202; §9.10).
 *
 * **Imported only where an instrument is**, which since task 202 is the notification module on the worker — so the HTTP
 * tier opens no metrics port until an instrument of its own needs one, and the worker opens exactly one however many
 * modules import this, Nest building a static module once.
 */
@Module({
  providers: [
    PrometheusMetrics,
    { provide: METER, inject: [PrometheusMetrics], useFactory: (metrics: PrometheusMetrics) => metrics.meter },
  ],
  exports: [METER],
})
export class MetricsModule {}

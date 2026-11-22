import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Meter } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import type { AppConfig } from '@api/config/configuration';

/** The meter every instrument is created from — an adapter asks for this, never for the exporter behind it. */
export const METER = Symbol('METER');

/** Where the metrics server listens: every IPv4 interface, so a scrape from outside the container reaches it. */
const METRICS_HOST = '0.0.0.0';

/**
 * The worker's metrics, served for Prometheus to pull (task 202; §9.10, §12.5.6's task-202 row (2)).
 *
 * **One `MeterProvider` and one exporter per process**, so every instrument any module creates lands on one `/metrics`
 * page. The exporter is a `MetricReader` with its own HTTP server, on `METRICS_PORT` — the worker's only listener,
 * which the edge never routes.
 *
 * **The server is started here, at module init, rather than by the exporter's constructor**, for two reasons the
 * exporter does not serve. Its constructor logs a failed listen and carries on, where a worker that cannot be scraped
 * should refuse to start, as one that cannot reach its storage does. And it reads port `0` as "the default", so a test
 * cannot ask it for a free port; `.env.test` names a port of its own instead.
 *
 * **No `target_info` and no scope labels**: Prometheus's scrape already says which job and which replica, and the
 * resource the SDK would describe here is `unknown_service:node`.
 */
@Injectable()
export class PrometheusMetrics implements OnModuleInit, OnModuleDestroy {
  readonly meter: Meter;
  private readonly exporter: PrometheusExporter;
  private readonly provider: MeterProvider;

  constructor(config: ConfigService<AppConfig, true>) {
    this.exporter = new PrometheusExporter({
      // Every IPv4 interface, stated because the exporter's own default is `localhost` — its typings say "all
      // interfaces", its code does not (0.301.2, read 22 Nov 2026) — and a worker in a container listening on its own
      // loopback is one no Prometheus can reach.
      host: METRICS_HOST,
      port: config.get('metrics.port', { infer: true }),
      preventServerStart: true,
      withoutTargetInfo: true,
      withoutScopeInfo: true,
    });
    this.provider = new MeterProvider({ readers: [this.exporter] });
    this.meter = this.provider.getMeter('easyesg');
  }

  async onModuleInit(): Promise<void> {
    await this.exporter.startServer();
  }

  /** Stops the server with the provider, so a closed application context leaves no port held. */
  async onModuleDestroy(): Promise<void> {
    await this.provider.shutdown();
  }
}

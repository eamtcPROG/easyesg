import { PrometheusExporter, PrometheusSerializer } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { OtelDispatchLatency } from './otel-dispatch-latency';
import { RAISE_TO_DISPATCH } from './raise-to-dispatch';

/**
 * NFR-106's histogram as Prometheus would scrape it (task 202; §12.5.6's task-202 row (4)) — the adapter over the SDK's
 * real meter, read back through the exporter's own serializer, so what is asserted is the text a scrape returns: the
 * series' name, its `channel` label, its buckets and its counts.
 *
 * **No port is opened here**: the exporter's server is the worker's, proven by `entrypoint-boot.e2e-spec.ts` in worker
 * mode, and a unit spec holding a port would meet a developer's worker on it.
 */
describe('OtelDispatchLatency (task 202)', () => {
  const RAISED_AT_MICROS = 1_790_726_400_000_000;
  const raisedAt = new Date(RAISED_AT_MICROS / 1000);
  const after = (seconds: number) => new Date(raisedAt.getTime() + seconds * 1000);

  const build = () => {
    const exporter = new PrometheusExporter({ preventServerStart: true });
    const provider = new MeterProvider({ readers: [exporter] });
    let now = raisedAt;
    const latency = new OtelDispatchLatency(provider.getMeter('spec'), () => now);
    const scrape = async (): Promise<string> => {
      const { resourceMetrics } = await exporter.collect();
      return new PrometheusSerializer('', false, undefined, true, true).serialize(resourceMetrics);
    };
    return { latency, scrape, at: (moment: Date) => (now = moment), close: () => provider.shutdown() };
  };

  const series = RAISE_TO_DISPATCH.name;

  it('records one observation per delivery, labelled by channel, timed from the raise to the clock', async () => {
    const { latency, scrape, at, close } = build();
    at(after(2.5));
    latency.dispatched({ channel: 'in_app', raisedAtMicros: RAISED_AT_MICROS, deliveries: 2 });
    at(after(7));
    latency.dispatched({ channel: 'email', raisedAtMicros: RAISED_AT_MICROS, deliveries: 1 });

    const text = await scrape();
    expect(text).toContain(`# TYPE ${series} histogram`);
    expect(text).toContain(`${series}_count{channel="in_app"} 2`);
    expect(text).toContain(`${series}_sum{channel="in_app"} 5`);
    expect(text).toContain(`${series}_bucket{channel="in_app",le="2"} 0`);
    expect(text).toContain(`${series}_bucket{channel="in_app",le="5"} 2`);
    expect(text).toContain(`${series}_count{channel="email"} 1`);
    expect(text).toContain(`${series}_bucket{channel="email",le="5"} 0`);
    expect(text).toContain(`${series}_bucket{channel="email",le="10"} 1`);
    await close();
  });

  it('carries every declared bucket, so the 60 s boundary is one Prometheus reads', async () => {
    const { latency, scrape, at, close } = build();
    at(after(1));
    latency.dispatched({ channel: 'email', raisedAtMicros: RAISED_AT_MICROS, deliveries: 1 });

    const bounds = [...(await scrape()).matchAll(/_bucket\{channel="email",le="([^"]+)"\}/g)].map((match) => match[1]);
    expect(bounds).toEqual([...RAISE_TO_DISPATCH.buckets.map(String), '+Inf']);
    await close();
  });

  it('counts a dispatch at exactly 60 s within NFR-106 and one a millisecond later outside it', async () => {
    const { latency, scrape, at, close } = build();
    at(after(60));
    latency.dispatched({ channel: 'email', raisedAtMicros: RAISED_AT_MICROS, deliveries: 1 });
    at(after(60.001));
    latency.dispatched({ channel: 'email', raisedAtMicros: RAISED_AT_MICROS, deliveries: 1 });

    const text = await scrape();
    expect(text).toContain(`${series}_bucket{channel="email",le="60"} 1`);
    expect(text).toContain(`${series}_bucket{channel="email",le="90"} 2`);
    await close();
  });

  it('records nothing for a write that reached nobody', async () => {
    const { latency, scrape, close } = build();
    latency.dispatched({ channel: 'in_app', raisedAtMicros: RAISED_AT_MICROS, deliveries: 0 });

    expect(await scrape()).not.toContain(`${series}_count`);
    await close();
  });
});

import { Injectable } from '@nestjs/common';
import { Reflector, type DiscoveryService } from '@nestjs/core';
import type { DataSource } from 'typeorm';
import { HandlesJob } from '../queue/job-handler';
import { RunsDaily } from './runs-daily';
import { ScheduleTicker } from './schedule-ticker.service';

@Injectable()
@HandlesJob('test.daily_sweep')
@RunsDaily({ at: '07:00', timezone: 'Europe/Chisinau' })
class DailySweep {}

@Injectable()
@RunsDaily({ at: '07:00', timezone: 'Europe/Chisinau' })
class UnroutedSweep {}

@Injectable()
@HandlesJob('test.malformed_sweep')
@RunsDaily({ at: '7am', timezone: 'Europe/Chisinau' })
class MalformedSweep {}

@Injectable()
@HandlesJob('test.unscheduled')
class Unscheduled {}

/** The statements the ticker sent, and whether the next one conflicts or fails. */
class FakeOutbox {
  readonly inserted: { eventType: string; payload: string; key: string }[] = [];
  readonly keys = new Set<string>();
  failNext = false;

  readonly dataSource = {
    transaction: async <T>(work: (manager: { queryRunner: unknown }) => Promise<T>): Promise<T> =>
      work({
        queryRunner: {
          query: (_sql: string, parameters: unknown[]) => {
            if (this.failNext) {
              this.failNext = false;
              return Promise.reject(new Error('connection lost'));
            }
            const [, eventType, payload, key] = parameters as [null, string, string, string];
            if (this.keys.has(key)) return Promise.resolve([]);
            this.keys.add(key);
            this.inserted.push({ eventType, payload, key });
            return Promise.resolve([{ idempotency_key: key }]);
          },
        },
      }),
  } as unknown as DataSource;
}

const discovering = (...providers: object[]): DiscoveryService =>
  ({ getProviders: () => providers.map((instance) => ({ instance })) }) as unknown as DiscoveryService;

const BEFORE_SEVEN = new Date('2026-10-09T03:59:00Z'); // 06:59 in Chișinău (UTC+3)
const AFTER_SEVEN = new Date('2026-10-09T04:01:00Z');
const LATER_THAT_DAY = new Date('2026-10-09T15:00:00Z');
const NEXT_DAY = new Date('2026-10-10T04:01:00Z');

function started(outbox: FakeOutbox, ...providers: object[]): ScheduleTicker {
  const ticker = new ScheduleTicker(outbox.dataSource, discovering(...providers), new Reflector());
  // Not `onModuleInit`, whose timer and first tick read the real clock: each spec ticks at the time it names.
  ticker.discoverJobs();
  return ticker;
}

describe('ScheduleTicker', () => {
  it('writes a job’s row once its slot opens, keyed by the job and the day, and once a day', async () => {
    const outbox = new FakeOutbox();
    const ticker = started(outbox, new DailySweep(), new Unscheduled());

    await ticker.tick(BEFORE_SEVEN);
    expect(outbox.inserted).toEqual([]);

    await ticker.tick(AFTER_SEVEN);
    await ticker.tick(LATER_THAT_DAY);
    expect(outbox.inserted).toEqual([
      { eventType: 'test.daily_sweep', payload: JSON.stringify({ day: '2026-10-09' }), key: 'test.daily_sweep/2026-10-09' },
    ]);

    await ticker.tick(NEXT_DAY);
    expect(outbox.inserted.map((row) => row.key)).toEqual([
      'test.daily_sweep/2026-10-09',
      'test.daily_sweep/2026-10-10',
    ]);
  });

  it('writes one row between two replicas, whichever opens the day first', async () => {
    const outbox = new FakeOutbox();
    const first = started(outbox, new DailySweep());
    const second = started(outbox, new DailySweep());

    await first.tick(AFTER_SEVEN);
    await second.tick(LATER_THAT_DAY);
    expect(outbox.inserted).toHaveLength(1);
  });

  it('tries a day again on the next tick when its write failed', async () => {
    const outbox = new FakeOutbox();
    const ticker = started(outbox, new DailySweep());

    outbox.failNext = true;
    await ticker.tick(AFTER_SEVEN);
    expect(outbox.inserted).toEqual([]);

    await ticker.tick(LATER_THAT_DAY);
    expect(outbox.inserted.map((row) => row.key)).toEqual(['test.daily_sweep/2026-10-09']);
  });

  it('keys a day’s row with no colon, which a queue job id may not carry', async () => {
    const outbox = new FakeOutbox();
    await started(outbox, new DailySweep()).tick(AFTER_SEVEN);
    expect(outbox.inserted.map((row) => row.key)).toEqual(['test.daily_sweep/2026-10-09']);
    expect(outbox.inserted.every((row) => !row.key.includes(':'))).toBe(true);
  });

  it('refuses to start on a daily job no handler routes', () => {
    expect(() => started(new FakeOutbox(), new UnroutedSweep())).toThrow(/handles no job/);
  });

  it('refuses to start on a slot it could not keep', () => {
    expect(() => started(new FakeOutbox(), new MalformedSweep())).toThrow(/not an HH:MM time/);
  });
});

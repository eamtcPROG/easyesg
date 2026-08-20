import { Queue } from 'bullmq';
import { DataSource, QueryRunner } from 'typeorm';
import { OutboxDispatcher } from '../src/infrastructure/outbox/outbox-dispatcher.service';
import { writeOutboxEvent } from '../src/infrastructure/outbox/outbox-writer';
import { OUTBOX_QUEUE } from '../src/infrastructure/queue/queue.constants';

/**
 * The transactional outbox (AD-6, AD-10, P-8, T-5).
 *
 * Two guarantees are under test and they fail in opposite directions:
 *
 *  - **No dual write.** An effect is recorded in the same transaction as the state change that
 *    caused it, so a rollback takes both. AD-10 rejects enqueueing from the request tier for
 *    exactly this: a job created for a transaction that then rolls back runs against state that
 *    never existed.
 *  - **At-least-once delivery, effectively-once processing.** T-5 refuses to claim exactly-once
 *    across a network boundary. What is claimed is that nothing is lost and nothing runs twice —
 *    the first from enqueueing before marking dispatched, the second from the idempotency key
 *    being the queue's job id.
 */

const ORGANIZATION = '01920000-0000-7000-8000-00000000000a';

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. Run via \`pnpm test:e2e\` with the stack up.`);
  return value;
};

const connect = async (userKey: string, passwordKey: string, applicationName: string) => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'esg',
    username: required(userKey),
    password: required(passwordKey),
    synchronize: false,
    entities: [],
    applicationName,
  });
  await dataSource.initialize();
  return dataSource;
};

/** Records what was enqueued and then fails, which is the crash window this suite exists for. */
const failingQueue = (recorded: string[]) =>
  ({
    add: (name: string, _data: unknown, options: { jobId: string }) => {
      recorded.push(options.jobId);
      return Promise.reject(new Error('redis went away mid-dispatch'));
    },
  }) as unknown as Queue;

/** Records and succeeds, so the transaction reaches its commit. */
const recordingQueue = (recorded: string[]) =>
  ({
    add: (name: string, _data: unknown, options: { jobId: string }) => {
      recorded.push(`${name}:${options.jobId}`);
      return Promise.resolve({ id: options.jobId });
    },
  }) as unknown as Queue;

describe('transactional outbox (AD-6, P-8, T-5)', () => {
  let owner: DataSource;
  let app: DataSource;
  let queue: Queue;

  beforeAll(async () => {
    owner = await connect('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-outbox-owner');
    app = await connect('DB_USER', 'DB_PASSWORD', 'easyesg-outbox-app');
    queue = new Queue(OUTBOX_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    });
  }, 30_000);

  afterAll(async () => {
    await queue?.close();
    if (owner?.isInitialized) await owner.destroy();
    if (app?.isInitialized) await app.destroy();
  });

  beforeEach(async () => {
    await owner.query(`DELETE FROM audit.outbox_event`);
    await queue.obliterate({ force: true });
  });

  const pending = async (): Promise<{ idempotency_key: string; attempts: number }[]> =>
    owner.query(
      `SELECT idempotency_key, attempts FROM audit.outbox_event
        WHERE dispatched_at IS NULL ORDER BY occurred_at`,
    );

  const seed = async (key: string, eventType = 'report.export.requested') => {
    const runner = owner.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await writeOutboxEvent(runner, {
      eventType,
      payload: { reportId: 'r-1' },
      organizationId: ORGANIZATION,
      idempotencyKey: key,
    });
    await runner.commitTransaction();
    await runner.release();
  };

  describe('no dual write (P-8)', () => {
    const inRolledBackTransaction = async (fn: (runner: QueryRunner) => Promise<void>) => {
      const runner = owner.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await fn(runner);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };

    it('loses the effect when the state change it belongs to rolls back', async () => {
      await inRolledBackTransaction(async (runner) => {
        await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORGANIZATION]);
        await runner.query(`INSERT INTO core.organization (id, name) VALUES ($1, 'Alpha SRL')`, [
          ORGANIZATION,
        ]);
        await writeOutboxEvent(runner, {
          eventType: 'organization.created',
          payload: {},
          organizationId: ORGANIZATION,
          idempotencyKey: 'rolled-back',
        });
        // Visible inside the transaction, which is what makes the absence afterwards meaningful.
        expect(await pendingOn(runner)).toEqual(['rolled-back']);
      });

      expect(await pending()).toEqual([]);
    });

    const pendingOn = async (runner: QueryRunner): Promise<string[]> => {
      const rows = (await runner.query(
        `SELECT idempotency_key FROM audit.outbox_event ORDER BY occurred_at`,
      )) as { idempotency_key: string }[];
      return rows.map((r) => r.idempotency_key);
    };

    it('refuses a duplicate idempotency key, so one business action yields one effect', async () => {
      await seed('order-42-invoice');
      await expect(seed('order-42-invoice')).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('dispatch', () => {
    it('enqueues by event type with the idempotency key as job id, then marks dispatched', async () => {
      await seed('export-1');
      const recorded: string[] = [];
      const dispatcher = new OutboxDispatcher(owner, recordingQueue(recorded));

      expect(await dispatcher.dispatchBatch()).toBe(1);
      expect(recorded).toEqual(['report.export.requested:export-1']);
      expect(await pending()).toEqual([]);
    });

    it('does nothing, and takes no transaction, when there is nothing to do', async () => {
      const dispatcher = new OutboxDispatcher(owner, recordingQueue([]));
      expect(await dispatcher.dispatchBatch()).toBe(0);
    });
  });

  describe('redelivery after a crash (T-5)', () => {
    /**
     * The window that decides whether this is an at-least-once system or an at-most-once one: the
     * job has reached the queue and the transaction has not committed. Enqueue-then-mark leaves the
     * row pending and it is re-emitted; mark-then-enqueue would lose it silently, because nothing
     * errors.
     */
    it('leaves the row pending when the dispatch fails after enqueueing', async () => {
      await seed('export-crash');
      const reached: string[] = [];
      const dispatcher = new OutboxDispatcher(owner, failingQueue(reached));

      await expect(dispatcher.dispatchBatch()).rejects.toThrow(/redis went away/);

      expect(reached).toEqual(['export-crash']);
      const rows = await pending();
      expect(rows.map((r) => r.idempotency_key)).toEqual(['export-crash']);
      // The attempt is counted in its own transaction — the failed one was rolled back and would
      // have discarded the count with everything else, so MAX_DISPATCH_ATTEMPTS would never arrive.
      expect(rows[0].attempts).toBe(1);
    });

    it('re-emits it on the next pass, and the queue discards the duplicate', async () => {
      await seed('export-dedup');

      // A real queue, because deduplication is BullMQ's behaviour and not something to assert
      // against a stub. This is the second half of AD-6: at-least-once delivery, effectively-once
      // processing.
      const dispatcher = new OutboxDispatcher(owner, queue);
      expect(await dispatcher.dispatchBatch()).toBe(1);

      // Put it back as though the commit had never happened, then dispatch again.
      await owner.query(`UPDATE audit.outbox_event SET dispatched_at = NULL`);
      expect(await dispatcher.dispatchBatch()).toBe(1);

      const counts = await queue.getJobCounts('waiting', 'delayed', 'active');
      expect(counts.waiting + counts.delayed + counts.active).toBe(1);
    });

    it('stops retrying a row that has exhausted its attempts, rather than blocking the queue', async () => {
      await seed('poisonous');
      await owner.query(`UPDATE audit.outbox_event SET attempts = 10`);

      const dispatcher = new OutboxDispatcher(owner, recordingQueue([]));
      expect(await dispatcher.dispatchBatch()).toBe(0);
      // Still pending and still visible: NFR-71 wants a tracked exception with an owner, not a row
      // that quietly disappears or one that retries for ever behind every healthy job.
      expect((await pending()).map((r) => r.idempotency_key)).toEqual(['poisonous']);
    });
  });

  describe('the grant model that stands in for RLS', () => {
    it('lets the application write an effect but never read one', async () => {
      const runner = app.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORGANIZATION]);
        await writeOutboxEvent(runner, {
          eventType: 'organization.created',
          payload: {},
          idempotencyKey: 'written-by-app',
        });
        await expect(runner.query(`SELECT 1 FROM audit.outbox_event`)).rejects.toThrow(
          /permission denied/i,
        );
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });
});

import { Queue } from 'bullmq';
import { DataSource, QueryRunner } from 'typeorm';
import { OutboxDispatcher } from '../src/infrastructure/outbox/outbox-dispatcher.service';
import { writeOutboxEvent } from '../src/infrastructure/outbox/outbox-writer';
import { isQueueableKey } from '../src/infrastructure/outbox/queueable-key';
import { OUTBOX_QUEUE } from '../src/infrastructure/queue/queue.constants';
import { DELIVERY_RETRY } from '../src/infrastructure/queue/retries-with';

/** Every job on AD-10's queue and the delivery retry — where the dispatcher puts a job whose handler declares neither. */
const DELIVERY_ONLY = { of: () => ({ queue: OUTBOX_QUEUE, retry: DELIVERY_RETRY }) };

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

/**
 * **This suite's own BullMQ key prefix, so nothing outside this file can reach its queue.**
 *
 * The queue *name* stays `OUTBOX_QUEUE`, because what is under test is the dispatcher putting the
 * idempotency key on the job that BullMQ then deduplicates by — a property of the name and the job
 * id, not of where the keys live. What the prefix removes is a dependency the test never meant to
 * assert and could not state: that **no consumer is running anywhere**.
 *
 * It is not hypothetical. `pnpm start:worker:dev` registers `OutboxConsumer` on the default prefix,
 * and a developer with one running turns the dedup test below red: the consumer takes the job off
 * `waiting`, finds no handler for `report.export.requested` — it routes three `identity.*` names —
 * and moves it to `failed`, so `waiting + delayed + active` is 0. Nothing in the failure mentions a
 * worker. Measured 9 Sep 2026: three runs of three red with one up, six of six green with it down.
 *
 * The coupling ran the other way too, and that half is worse than a flake: `beforeEach` obliterates,
 * which on the shared prefix **deletes a developer's own dev queue**. A suite-owned prefix is what
 * makes that destruction impossible rather than merely unobserved.
 */
const QUEUE_PREFIX = 'bull:e2e-outbox';

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

/**
 * A connection whose mark fails — the statement after the enqueue — which is the crash window this suite exists for:
 * the job has reached the queue and the transaction has not committed. The dispatcher reads nothing else from its
 * `DataSource`, so this is the whole of what it is handed.
 */
const crashingAtMark = (dataSource: DataSource): DataSource =>
  ({
    createQueryRunner: () => {
      const runner = dataSource.createQueryRunner();
      const query = runner.query.bind(runner);
      runner.query = ((sql: string, parameters?: unknown[]) =>
        sql.includes('SET dispatched_at')
          ? Promise.reject(new Error('the worker died before its commit'))
          : query(sql, parameters)) as QueryRunner['query'];
      return runner;
    },
  }) as unknown as DataSource;

/** Refuses one job id, as BullMQ refuses a key it cannot take, and records and takes every other. */
const refusingQueue = (refused: string, recorded: string[]) =>
  ({
    add: (name: string, _data: unknown, options: { jobId: string }) => {
      if (options.jobId === refused) return Promise.reject(new Error('Custom Id cannot contain :'));
      recorded.push(`${name}:${options.jobId}`);
      return Promise.resolve({ id: options.jobId });
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
      prefix: QUEUE_PREFIX,
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

  /**
   * **Scoped to this suite's own organization** (27 Aug 2026, review).
   *
   * It was an unscoped `DELETE FROM audit.outbox_event`, which today is harmless only because
   * `test:e2e` runs one file at a time (`--maxWorkers=1` since task 47's close, recycling its worker; `--runInBand` until
   * then) and `pnpm gates` runs the browser suite after this one — so no
   * two writers of this table are ever live at once. That is a property of the runner, not of the
   * test, and the day someone parallelises the e2e suites (the obvious optimisation as they grow)
   * this would silently delete another suite's pending rows and the failures would surface over
   * there. Every sibling suite already scopes its own cleanup; this was the one that did not.
   *
   * `ORGANIZATION` is this file's own constant and everything it writes goes through `seed`, so the
   * scope is exact rather than a prefix convention.
   */
  beforeEach(async () => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORGANIZATION]);
    await queue.obliterate({ force: true });
    await expectNoStrayRows();
  });

  /**
   * **The precondition this file cannot scope away, checked before every test rather than assumed.**
   *
   * `dispatchBatch` polls every pending row regardless of tenant — the dispatcher is global by
   * design (§6.7's single producer) — so three tests below count what a global sweep did and are
   * wrong by exactly the number of rows somebody else left behind.
   *
   * Deliberately **not** manufactured with `DELETE … WHERE dispatched_at IS NULL`: that is the
   * cross-suite destruction this file was corrected for, moved one hook lower, and it is what hid
   * `signInFreshAccount`'s leak for seven suites. Asserted here, at the top, so a stray row fails
   * with its own count and a sentence naming the cause instead of surfacing three tests later as
   * `expected 1, received 21`. On CI the database is fresh; locally this is what tells you a
   * previous partial run is still in the table.
   */
  const expectNoStrayRows = async (): Promise<void> => {
    // Names the rows rather than counting them: "1 stray row" sends the next reader hunting, while
    // `identity.email_verification.requested / ana@…` names the suite that owes a cleanup.
    const rows: { event_type: string; subject: string | null }[] = await owner.query(
      `SELECT event_type, payload->>'email' AS subject FROM audit.outbox_event
        WHERE dispatched_at IS NULL AND organization_id IS DISTINCT FROM $1
        ORDER BY occurred_at`,
      [ORGANIZATION],
    );
    expect({
      hint: 'a suite that signs actors in must call cleanupSignedInAccounts({ owner }) in afterAll',
      strays: rows.map((r) => `${r.event_type}${r.subject ? ` / ${r.subject}` : ''}`),
    }).toEqual({
      hint: 'a suite that signs actors in must call cleanupSignedInAccounts({ owner }) in afterAll',
      strays: [],
    });
  };

  /**
   * Also scoped, and for a sharper reason than the cleanup: `dispatchBatch` polls **every** pending
   * row, because the dispatcher is global by design (AD-6). A read that was not scoped would make
   * "nothing is pending" an assertion about the whole database — see the `dispatch` describe, where
   * that is stated as a precondition rather than left implicit.
   */
  const pending = async (): Promise<{ idempotency_key: string; attempts: number }[]> =>
    owner.query(
      `SELECT idempotency_key, attempts FROM audit.outbox_event
        WHERE dispatched_at IS NULL AND organization_id = $1 ORDER BY occurred_at`,
      [ORGANIZATION],
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
        await runner.query(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Alpha SRL', 'MD')`, [
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

    /** Scoped like `pending()` above, and for the same reason — see its note. */
    const pendingOn = async (runner: QueryRunner): Promise<string[]> => {
      const rows = (await runner.query(
        `SELECT idempotency_key FROM audit.outbox_event
          WHERE organization_id = $1 ORDER BY occurred_at`,
        [ORGANIZATION],
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
      const dispatcher = new OutboxDispatcher(owner, recordingQueue(recorded), recordingQueue(recorded), DELIVERY_ONLY);

      expect(await dispatcher.dispatchBatch()).toBe(1);
      expect(recorded).toEqual(['report.export.requested:export-1']);
      expect(await pending()).toEqual([]);
    });

    /**
     * What a job carries besides its payload, which no consumer can read from anywhere else: the organization, for
     * §7.6's tenant binding, and since task 50.1.3 the row's own time, which is how a notification's cancellation
     * and its raise are ordered when parallel workers take them in either order. The notification suites build their
     * jobs by hand, so this is the case that fails if the dispatcher stops carrying either.
     */
    it("carries the row's organization and time onto the job, beside its payload", async () => {
      await seed('export-carried');
      const [row] = await owner.query<{ occurred_micros: string }[]>(
        `SELECT (extract(epoch FROM occurred_at) * 1000000)::bigint AS occurred_micros
           FROM audit.outbox_event WHERE idempotency_key = 'export-carried'`,
      );
      const carried: unknown[] = [];
      const capturing = {
        add: (_name: string, data: unknown, options: { jobId: string }) => {
          carried.push(data);
          return Promise.resolve({ id: options.jobId });
        },
      } as unknown as Queue;

      expect(await new OutboxDispatcher(owner, capturing, capturing, DELIVERY_ONLY).dispatchBatch()).toBe(1);
      expect(carried).toEqual([
        { reportId: 'r-1', organizationId: ORGANIZATION, occurredAtMicros: Number(row.occurred_micros) },
      ]);
    });

    /**
     * **The one assertion in this file that is about the whole table**, and it has to be: the
     * dispatcher polls every pending row regardless of tenant, which is AD-6's design and the point
     * of §6.7's single producer. So this test cannot be scoped the way the cleanup above is — it is
     * asserting that a global sweep finds nothing.
     *
     * It therefore depends on no other suite holding an undispatched row, which one file at a time (`--maxWorkers=1`) plus
     * `gates`' sequencing currently guarantees. Stated here rather than left implicit, so that a
     * later move to parallel e2e has one place telling it what breaks and why.
     */
    it('does nothing, and takes no transaction, when there is nothing to do', async () => {
      const dispatcher = new OutboxDispatcher(owner, recordingQueue([]), recordingQueue([]), DELIVERY_ONLY);
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
      const dispatcher = new OutboxDispatcher(crashingAtMark(owner), recordingQueue(reached), recordingQueue(reached), DELIVERY_ONLY);

      await expect(dispatcher.dispatchBatch()).rejects.toThrow(/died before its commit/);

      expect(reached).toEqual(['report.export.requested:export-crash']);
      // Pending, and charged nothing (task 206): the failure was after the enqueue, so it is no row's, and the next
      // pass re-emits the row under the same job id — which the case below shows the queue discarding.
      expect(await pending()).toEqual([{ idempotency_key: 'export-crash', attempts: 0 }]);
    });

    it('re-emits it on the next pass, and the queue discards the duplicate', async () => {
      await seed('export-dedup');

      // A real queue, because deduplication is BullMQ's behaviour and not something to assert
      // against a stub. This is the second half of AD-6: at-least-once delivery, effectively-once
      // processing.
      const dispatcher = new OutboxDispatcher(owner, queue, queue, DELIVERY_ONLY);
      expect(await dispatcher.dispatchBatch()).toBe(1);

      // Put it back as though the commit had never happened, then dispatch again. Scoped like the cleanup above
      // (task 206): unscoped, this reopened every row other suites had left dispatched in a long-lived test stack.
      await owner.query(`UPDATE audit.outbox_event SET dispatched_at = NULL WHERE organization_id = $1`, [ORGANIZATION]);
      expect(await dispatcher.dispatchBatch()).toBe(1);

      const counts = await queue.getJobCounts('waiting', 'delayed', 'active');
      expect(counts.waiting + counts.delayed + counts.active).toBe(1);
    });

    it('stops retrying a row that has exhausted its attempts, rather than blocking the queue', async () => {
      await seed('poisonous');
      await owner.query(`UPDATE audit.outbox_event SET attempts = 10 WHERE organization_id = $1`, [ORGANIZATION]);

      const dispatcher = new OutboxDispatcher(owner, recordingQueue([]), recordingQueue([]), DELIVERY_ONLY);
      expect(await dispatcher.dispatchBatch()).toBe(0);
      // Still pending and still visible: NFR-71 wants a tracked exception with an owner, not a row
      // that quietly disappears or one that retries for ever behind every healthy job.
      expect((await pending()).map((r) => r.idempotency_key)).toEqual(['poisonous']);
    });

    /**
     * Task 206 (§12.5.6's task-206 row (4)). One refused row failed the whole batch until then, and every row in it wore
     * the attempt, so after ten passes its neighbours stopped being retried too — an unrelated notice dropped for
     * sharing a batch. Removing the per-row catch fails this case three ways: the batch rejects, nothing is
     * dispatched, and both neighbours are charged.
     */
    it('charges the row the queue refuses, alone, and dispatches the rest of its batch', async () => {
      await seed('export-before');
      await seed('export-refused');
      await seed('export-after');
      const recorded: string[] = [];

      expect(await new OutboxDispatcher(owner, refusingQueue('export-refused', recorded), refusingQueue('export-refused', recorded), DELIVERY_ONLY).dispatchBatch()).toBe(2);

      expect(recorded).toEqual(['report.export.requested:export-before', 'report.export.requested:export-after']);
      expect(await pending()).toEqual([{ idempotency_key: 'export-refused', attempts: 1 }]);
      const [refused] = await owner.query<{ last_error: string }[]>(
        `SELECT last_error FROM audit.outbox_event WHERE idempotency_key = 'export-refused'`,
      );
      expect(refused.last_error).toBe('Custom Id cannot contain :');
    });
  });

  /**
   * The key rule's two copies, held to each other and to the queue (task 206; §12.5.6's task-206 row (2)). The writers
   * ask `isQueueableKey`; the table asks `outbox_event_key_queueable`; BullMQ is what both stand in front of. Each key
   * below runs through all three, so a copy edited alone, or a BullMQ release that stops taking a key the rule admits,
   * fails here rather than at a dispatcher on a weekend.
   */
  describe('a key the queue will take (task 206)', () => {
    // The scheduled-job shape on a day no ticker opens: on the day a worker on this stack wrote its own sweep row, the
    // real key would collide with that row on the idempotency index and the case would compare nothing.
    const KEYS = [
      'identity.email_verification.requested/0192f000-0000-7000-8000-000000000001/1790726400000',
      'validation.report_notice_sweep/2000-01-01',
      '0192f000-0000-7000-8000-000000000001',
      'invoice/0042',
      'identity.invitation.issued:invitation-1:1790726400000',
      'validation.report_notice_sweep:2000-01-01',
      '42',
      '-42',
      '0042',
      '',
    ];

    /** Inserted past the writers, which would refuse first, inside a transaction that is always rolled back. */
    const tableTakes = async (key: string): Promise<boolean> => {
      const runner = owner.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(
          `INSERT INTO audit.outbox_event (organization_id, event_type, idempotency_key)
           VALUES ($1, 'report.export.requested', $2)`,
          [ORGANIZATION, key],
        );
        return true;
      } catch (error) {
        // Only this constraint counts as a refusal; any other failure is the test's and is thrown.
        if (error instanceof Error && error.message.includes('outbox_event_key_queueable')) return false;
        throw error;
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };

    it('is refused by the table exactly where the writers refuse it', async () => {
      const verdicts: Record<string, { writers: boolean; table: boolean }> = {};
      for (const key of KEYS) verdicts[key] = { writers: isQueueableKey(key), table: await tableTakes(key) };

      for (const [key, { writers, table }] of Object.entries(verdicts)) expect({ key, table }).toEqual({ key, table: writers });
      // Both outcomes occur, or agreement would prove nothing.
      expect(new Set(Object.values(verdicts).map(({ writers }) => writers))).toEqual(new Set([true, false]));
    });

    /**
     * A real queue, because which ids BullMQ takes is its behaviour, not a stub's. "Takes" means the job exists under
     * the key itself: an empty id is not refused but replaced by a counter, which is the deduplication lost.
     */
    it('is one every key the rule admits is taken under, by the queue', async () => {
      const admitted = KEYS.filter(isQueueableKey);
      expect(admitted.length).toBeGreaterThan(0);
      for (const key of admitted) {
        const job = await queue.add('report.export.requested', {}, { jobId: key });
        expect({ key, id: job.id }).toEqual({ key, id: key });
      }
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

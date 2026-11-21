import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { ACCOUNT_COLUMNS, toAccount, type AccountRow } from '../src/infrastructure/persistence/identity/account-row';
import { LapsedAccountStoreRepository } from '../src/infrastructure/persistence/identity/lapsed-account-store.repository';
import { LAPSED_ACCOUNT_SWEEP } from '../src/modules/identity/account/constants/account.constants';
import { LapsedAccountSweepHandler } from '../src/modules/identity/account/consumers/lapsed-account-sweep.handler';
import { accountHasLapsed, UNVERIFIED_ACCOUNT_TTL_MS } from '../src/modules/identity/account/domain/account-expiry';
import { ACCOUNT_STATUS, type AccountStatus } from '../src/modules/identity/account/models/account.model';
import { ReclaimLapsedAccounts } from '../src/modules/identity/account/use-cases/reclaim-lapsed-accounts.use-case';
import { connectAs, databaseNow } from './support/database';
import { LEGAL_ACCEPTANCE, PASSWORD } from './support/signed-in-account';

/**
 * OQ-52's reclaiming sweep (task 200; FR-3 AC-7; `architecture.md` §12.5.6's task-200 row).
 *
 * **What this proves is that the sweep and the point-of-use rule are one rule** (row (2)). The database function states
 * the window in SQL and `accountHasLapsed` states it in TypeScript, so the corpus is seeded either side of each edge from
 * `UNVERIFIED_ACCOUNT_TTL_MS` itself, and the function must delete exactly the rows `accountHasLapsed` calls lapsed: a
 * window changed in either copy alone, a status arm dropped, or the setup arm measured from registration rather than its
 * deadline, each leaves a row on the wrong side.
 *
 * **The sweep runs as the worker runs it** — the handler, its use case and its store on `esg_worker`, given the payload
 * the dispatcher writes — and the worker holds no other way to delete an account, which is asserted too.
 *
 * **Times are the database's**, since the function measures by its clock (`apps/api/CLAUDE.md`, the `databaseNow`
 * note); a minute either side of each edge is far wider than the seconds between seeding and sweeping.
 */
const MARGIN_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const SUITE = `task200-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${SUITE}-${label}@example.md`;

/** One account the suite seeds: its status, how long ago it registered, and — in setup — its deadline from now. */
interface Seed {
  readonly label: string;
  readonly status: AccountStatus;
  readonly registeredMsAgo: number;
  readonly deadlineMsFromNow: number | null;
}

const UNVERIFIED_INSIDE: Seed = {
  label: 'unverified-inside',
  status: ACCOUNT_STATUS.UNVERIFIED,
  registeredMsAgo: UNVERIFIED_ACCOUNT_TTL_MS - MARGIN_MS,
  deadlineMsFromNow: null,
};
const UNVERIFIED_PAST: Seed = {
  label: 'unverified-past',
  status: ACCOUNT_STATUS.UNVERIFIED,
  registeredMsAgo: UNVERIFIED_ACCOUNT_TTL_MS + MARGIN_MS,
  deadlineMsFromNow: null,
};
// Active long past the window: verification ends the window, so no arm reaches it.
const ACTIVE_OLD: Seed = {
  label: 'active-old',
  status: ACCOUNT_STATUS.ACTIVE,
  registeredMsAgo: 10 * UNVERIFIED_ACCOUNT_TTL_MS,
  deadlineMsFromNow: null,
};
const SETUP_PAST: Seed = {
  label: 'setup-past',
  status: ACCOUNT_STATUS.AWAITING_SETUP,
  registeredMsAgo: UNVERIFIED_ACCOUNT_TTL_MS + MARGIN_MS,
  deadlineMsFromNow: -MARGIN_MS,
};
// Registered long ago with its deadline still ahead: the stored deadline decides, never the account's age.
const SETUP_AHEAD: Seed = {
  label: 'setup-ahead',
  status: ACCOUNT_STATUS.AWAITING_SETUP,
  registeredMsAgo: 2 * UNVERIFIED_ACCOUNT_TTL_MS,
  deadlineMsFromNow: MARGIN_MS,
};
// Moved into setup from active: it carries no deadline, may hold organizations, and is never deleted by this rule.
const SETUP_NO_DEADLINE: Seed = {
  label: 'setup-no-deadline',
  status: ACCOUNT_STATUS.AWAITING_SETUP,
  registeredMsAgo: 10 * UNVERIFIED_ACCOUNT_TTL_MS,
  deadlineMsFromNow: null,
};

const CORPUS = [UNVERIFIED_INSIDE, UNVERIFIED_PAST, ACTIVE_OLD, SETUP_PAST, SETUP_AHEAD, SETUP_NO_DEADLINE];

describe('lapsed accounts, reclaimed (task 200)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  /** `esg_app`, the request tier's role. */
  let requestTier: DataSource;
  /** Each seed's id, by label, as the database minted it. */
  const ids = new Map<string, string>();
  /** The rows as seeded, read back before the sweep — what `accountHasLapsed` is asked about. */
  let seededRows: AccountRow[];
  /** The database's moment just before the sweep ran. */
  let sweptAt: Date;
  let reclaimed: number;

  /** Seeds one account as the owner, its times relative to the database's `at`. */
  const seed = async (input: Seed, at: Date): Promise<string> => {
    const registeredAt = new Date(at.getTime() - input.registeredMsAgo);
    const deadline = input.deadlineMsFromNow === null ? null : new Date(at.getTime() + input.deadlineMsFromNow);
    const verifiedAt = input.status === ACCOUNT_STATUS.UNVERIFIED ? null : registeredAt;
    const rows: { id: string }[] = await owner.query(
      `INSERT INTO identity.account (email, locale, status, verified_at, setup_expires_at, created_at, updated_at)
       VALUES ($1, 'ro', $2, $3, $4, $5, $5)
       RETURNING id`,
      [addressFor(input.label), input.status, verifiedAt, deadline, registeredAt],
    );
    return rows[0].id;
  };

  /** Sorted here rather than by `ORDER BY`, whose collation need not order hyphens as the expectations below do. */
  const accountsLeft = async (labels: readonly string[]): Promise<string[]> => {
    const rows: { email: string }[] = await owner.query(`SELECT email FROM identity.account WHERE email = ANY($1)`, [
      labels.map(addressFor),
    ]);
    return rows.map((row) => row.email).sort();
  };

  /** How many rows a count query finds, as the owner. */
  const countOf = async (sql: string, parameters: unknown[]): Promise<number> => {
    const rows: { count: number }[] = await owner.query(sql, parameters);
    return rows[0].count;
  };

  /** The account a registration answered with, out of its envelope. */
  const registered = (response: { body: unknown }) =>
    (response.body as { object: { id: string; email: string; status: string } }).object;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, givenName: 'Ana', familyName: 'Popescu', ...LEGAL_ACCEPTANCE });

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-lapsed-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-lapsed-worker');
    requestTier = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-lapsed-app');

    const at = await databaseNow(owner);
    for (const input of CORPUS) ids.set(input.label, await seed(input, at));

    // What OQ-52's deletion is for: the password hash and the live challenge go with the account.
    const pastId = ids.get(UNVERIFIED_PAST.label);
    await owner.query(`INSERT INTO identity.credential (account_id, password_hash) VALUES ($1, 'not-a-hash')`, [pastId]);
    await owner.query(
      `INSERT INTO identity.verification_token (account_id, token_hash, expires_at) VALUES ($1, $2, now())`,
      [pastId, randomBytes(32)],
    );

    seededRows = await owner.query(`SELECT ${ACCOUNT_COLUMNS} FROM identity.account WHERE id = ANY($1)`, [
      [...ids.values()],
    ]);

    sweptAt = await databaseNow(owner);
    const handler = new LapsedAccountSweepHandler(
      new ReclaimLapsedAccounts(new LapsedAccountStoreRepository(worker)),
    );
    await handler.handle(
      { occurredAtMicros: sweptAt.getTime() * 1000 },
      { jobId: 'task200', jobName: LAPSED_ACCOUNT_SWEEP, attempt: 1, attempts: 1 },
    );
    // The handler answers nothing; a second run straight after is asked what the first left.
    reclaimed = await new LapsedAccountStoreRepository(worker).reclaimLapsed();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    // As the owner: `esg_app` cannot read the outbox, and the accounts take their credentials and tokens by cascade.
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${SUITE}-%`]);
    await owner?.query(`DELETE FROM audit.outbox_event WHERE payload->>'email' LIKE $1`, [`${SUITE}-%`]);
    await owner?.destroy();
    await worker?.destroy();
    await requestTier?.destroy();
  });

  it('names, by the point-of-use rule, exactly the account unverified past its window and the setup past its deadline', () => {
    // The corpus's own meaning, pinned, so the comparison below cannot pass by both sides calling nothing lapsed.
    const lapsedByRule = seededRows
      .filter((row) => accountHasLapsed(toAccount(row), sweptAt))
      .map((row) => row.email)
      .sort();
    expect(lapsedByRule).toEqual([addressFor(SETUP_PAST.label), addressFor(UNVERIFIED_PAST.label)].sort());
  });

  it('deletes exactly the accounts the point-of-use rule calls lapsed, and keeps every other', async () => {
    const keptByRule = seededRows
      .filter((row) => !accountHasLapsed(toAccount(row), sweptAt))
      .map((row) => row.email)
      .sort();

    expect(await accountsLeft(CORPUS.map((input) => input.label))).toEqual(keptByRule);
  });

  it('takes the password hash and the outstanding link with the account', async () => {
    const pastId = ids.get(UNVERIFIED_PAST.label);
    const credentials = await countOf(`SELECT count(*)::int AS count FROM identity.credential WHERE account_id = $1`, [
      pastId,
    ]);
    const tokens = await countOf(
      `SELECT count(*)::int AS count FROM identity.verification_token WHERE account_id = $1`,
      [pastId],
    );
    expect({ credentials, tokens }).toEqual({ credentials: 0, tokens: 0 });
  });

  it('finds nothing left to reclaim on a second run, the first having taken it', () => {
    expect(reclaimed).toBe(0);
  });

  it('gives the worker no way to delete an account but the function', async () => {
    await expect(
      worker.query(`DELETE FROM identity.account WHERE id = $1`, [ids.get(ACTIVE_OLD.label)]),
    ).rejects.toThrow(/permission denied/);
    expect(await accountsLeft([ACTIVE_OLD.label])).toEqual([addressFor(ACTIVE_OLD.label)]);
  });

  it('gives the request tier no way to run the sweep', async () => {
    await expect(requestTier.query(`SELECT identity.reclaim_lapsed_accounts()`)).rejects.toThrow(/permission denied/);
  });

  describe('registering the same address again (unchanged)', () => {
    it('registers the address of an account the sweep removed, as a new account', async () => {
      const response = await register(addressFor(UNVERIFIED_PAST.label)).expect(201);
      expect(registered(response)).toMatchObject({ email: addressFor(UNVERIFIED_PAST.label), status: 'unverified' });
      expect(registered(response).id).not.toBe(ids.get(UNVERIFIED_PAST.label));
    });

    it('registers the address of a lapsed account the sweep has not reached, replacing it', async () => {
      const unswept: Seed = {
        label: 'unswept',
        status: ACCOUNT_STATUS.UNVERIFIED,
        registeredMsAgo: UNVERIFIED_ACCOUNT_TTL_MS + DAY_MS,
        deadlineMsFromNow: null,
      };
      const unsweptId = await seed(unswept, await databaseNow(owner));

      const response = await register(addressFor(unswept.label)).expect(201);
      expect(registered(response).id).not.toBe(unsweptId);
      expect(await countOf(`SELECT count(*)::int AS count FROM identity.account WHERE id = $1`, [unsweptId])).toBe(0);
    });

    it('still refuses the address of an account inside its window', async () => {
      await register(addressFor(UNVERIFIED_INSIDE.label)).expect(409);
    });
  });
});

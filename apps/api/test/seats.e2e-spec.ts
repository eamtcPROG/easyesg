import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource, QueryRunner } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { runInRequestContext } from '../src/infrastructure/persistence/request-context';
import { configureHttpApp } from '../src/main.http';
import { INVITATION_ISSUED } from '../src/modules/identity/invitation/constants/invitation.constants';
import {
  INVITATION_STORE,
  type InvitationStore,
} from '../src/modules/identity/invitation/interfaces/invitation-store.interface';
import { INVITED_ROLE } from '../src/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * The interim seat ceiling, end to end (task 142; `architecture.md` §12.5.6's task-142 row) — against
 * the shipped `seat_allowance` artefact, real RLS, the real request transaction and real concurrency.
 *
 * Four claims here that no unit spec can make, and each is why this suite exists:
 *
 *  - **A refusal leaves nothing behind.** The issue gate checks after its insert, so what undoes the
 *    row, the throttle attempt and the email is the request's rollback — which a fake cannot model.
 *  - **The lock bites.** Two invitations at the last seat each see only their own insert; only a
 *    serialised count lets exactly one through — proven on two real transactions interleaved by
 *    hand, because two HTTP requests fired together turned out not to prove it (the case says why).
 *  - **An over-ceiling acceptance rolls back whole**, so the link still works once a seat is freed.
 *  - **The seats read counts what the list lists** — the one statement behind both gates and the
 *    screen, held equal to `GET /access`'s unfiltered total.
 *
 * **The organization is filled with bare accounts inserted as the owner**, not with signed-in actors:
 * a seat is a membership row, and ten Argon2 registrations would buy nothing the rows do not.
 */

const ORG = '01920000-0000-7000-8000-0000000001a1';

/** The shipped ceiling — `seat-allowance.service.spec.ts` pins the artefact to it. */
const CEILING = 10;

const EMAILS = {
  admin: 'oa@seats.test',
  admitted: 'admitted@seats.test',
  overCeiling: 'over-ceiling@seats.test',
};

/** Every address this suite invites or seeds ends in this, so cleanup can find them all. */
const SUITE_DOMAIN = 'seats.test';

/** Bare accounts holding a seat each, on a subdomain the cleanup can delete by. */
const FILLER_DOMAIN = `filler.${SUITE_DOMAIN}`;

describe('the interim seat ceiling (task 142)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  /** As `esg_app`, for the two hand-interleaved transactions the lock case drives. */
  let application: DataSource;

  let admin: SignedInAccount;
  let admitted: SignedInAccount;
  let overCeiling: SignedInAccount;

  /** How many fillers this test has created, so each gets a fresh address. */
  let fillers = 0;

  const http = () => request(app.getHttpServer());

  const grant = async (account: SignedInAccount, role: string) => {
    await asOrganization(owner, ORG, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
        account.accountId,
        ORG,
        role,
      ]),
    );
  };

  /** `count` more seats held by active members, each a bare account with no session. */
  const fill = async (count: number) => {
    const from = fillers;
    fillers += count;
    await owner.query(
      `INSERT INTO identity.account (email, locale)
       SELECT 'filler-' || n || '@' || $1, 'ro' FROM generate_series($2::int, $3::int) AS n`,
      [FILLER_DOMAIN, from, fillers - 1],
    );
    await asOrganization(owner, ORG, (run) =>
      run(
        `INSERT INTO identity.membership (account_id, organization_id, role)
         SELECT a.id, $1, 'editor' FROM identity.account a
          WHERE a.email = ANY($2)`,
        [ORG, Array.from({ length: count }, (_, index) => `filler-${from + index}@${FILLER_DOMAIN}`)],
      ),
    );
  };

  /** One seat freed: a filler's account deleted, taking its membership with it by the cascade. */
  const freeOneSeat = async () => {
    fillers -= 1;
    await owner.query(`DELETE FROM identity.account WHERE email = $1`, [
      `filler-${fillers}@${FILLER_DOMAIN}`,
    ]);
  };

  /**
   * A pending invitation already past its seven days, seeded rather than waited for.
   *
   * **The token is random per call**, because `token_hash` is unique across every row the table has
   * ever held and revoked rows stay: an address-derived token collides the second time a test seeds
   * the same address, however cleanly the first was revoked.
   */
  const lapsedInvitation = async (email: string): Promise<string> => {
    const rows = await asOrganization(owner, ORG, (run) =>
      run(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at)
         VALUES ($1, $2, 'editor', 'ro', sha256($3::bytea), now() - interval '1 day')
         RETURNING id`,
        [ORG, email, Buffer.from(randomUUID(), 'utf8')],
      ),
    );
    return (rows as { id: string }[])[0].id;
  };

  const invite = (email: string): request.Test =>
    http()
      .post('/api/v1/invitations')
      .set(admin.authorization)
      .send({ email, role: INVITED_ROLE.EDITOR });

  const accept = (account: SignedInAccount, token: string): request.Test =>
    http().post('/api/v1/invitations/acceptance').set(account.authorization).send({ token });

  const readSeats = async (): Promise<{ allowance: number | null; used: number }> => {
    const res = await http().get('/api/v1/access/seats').set(admin.authorization).expect(200);
    return (res.body as { object: { allowance: number | null; used: number } }).object;
  };

  const tokenFor = async (email: string): Promise<string> => {
    const rows = await worker.query<{ payload: { token: string } }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2
        ORDER BY occurred_at DESC, id DESC`,
      [INVITATION_ISSUED, email],
    );
    return rows[0].payload.token;
  };

  const invitationRows = async (email: string): Promise<{ status: string }[]> =>
    (await asOrganization(owner, ORG, (run) =>
      run(`SELECT status FROM identity.invitation WHERE invited_email = $1`, [email]),
    )) as { status: string }[];

  const queuedEmails = async (email: string): Promise<number> => {
    const rows = await worker.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit.outbox_event
        WHERE event_type = $1 AND payload->>'email' = $2`,
      [INVITATION_ISSUED, email],
    );
    return rows[0].n;
  };

  /** Throttle rows naming a subject — an address for the mail window, an account for acceptance. */
  const attemptsNaming = async (subject: string): Promise<number> => {
    const rows = await owner.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM identity.auth_attempt WHERE attempt_key LIKE '%' || $1`,
      [subject],
    );
    return rows[0].n;
  };

  const unseed = async () => {
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1) OR email LIKE $2`, [
      Object.values(EMAILS),
      `%@${FILLER_DOMAIN}`,
    ]);
    await owner.query(
      `DELETE FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' LIKE $2`,
      [INVITATION_ISSUED, `%${SUITE_DOMAIN}`],
    );
  };

  /**
   * Each test starts from the administrator alone. Invitations are **revoked, not deleted** — there
   * is no `DELETE` policy on the table, so even the owner removes nothing (`invitations.e2e-spec.ts`
   * carries the account) — and the invitees are un-joined rather than deleted, because they hold
   * sessions this suite signed in once.
   */
  const reset = async () => {
    fillers = 0;
    await asOrganization(owner, ORG, async (run) => {
      await run(
        `UPDATE identity.invitation SET status = 'revoked', revoked_at = now(), updated_at = now()
          WHERE status = 'pending'`,
      );
      await run(
        `UPDATE identity.membership SET status = 'removed', removed_at = now(), updated_at = now()
          WHERE account_id <> $1 AND status = 'active'`,
        [admin.accountId],
      );
    });
    await owner.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`%@${FILLER_DOMAIN}`]);
    await owner.query(
      `DELETE FROM audit.outbox_event WHERE event_type = $1 AND payload->>'email' LIKE $2`,
      [INVITATION_ISSUED, `%${SUITE_DOMAIN}`],
    );
    // Both invitation windows — the mail window keyed by address, the acceptance window by account —
    // drained with the rows they count, per `invitations.e2e-spec.ts`'s standing lesson: a suite that
    // spends a window must drain it, or it reports 429 from inside a helper.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'invitation-%'`);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-seats-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-seats-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-seats-app');
    await unseed();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Seats SRL', 'MD')`, [
        ORG,
      ]),
    );

    const server = app.getHttpServer();
    const sign = (email: string) => signInFreshAccount({ server, worker, email });
    admin = await sign(EMAILS.admin);
    admitted = await sign(EMAILS.admitted);
    overCeiling = await sign(EMAILS.overCeiling);
    await grant(admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await unseed();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
    if (application?.isInitialized) await application.destroy();
    await app?.close();
  });

  beforeEach(reset);

  // ── The read ──────────────────────────────────────────────────────────────────────────────────

  /**
   * **Every row kind that holds no seat is seeded beside the ones that do** (task 142's gate-integrity
   * review). Without them this case could see only one divergence — a lapsed invitation — and a count
   * that also held removed members stayed green here; only test order elsewhere noticed. So a removed
   * member, a revoked invitation and an accepted one sit in the organization too, and both reads must
   * still say five: a count or a union widened to any of them fails the equality in either direction.
   */
  it('publishes the ceiling and the seats held, lapsed invitations included, agreeing with the list', async () => {
    await fill(3);
    await invite(EMAILS.admitted).expect(201);
    await lapsedInvitation(`lapsed@${SUITE_DOMAIN}`);

    // The rows that hold nothing: one of the fillers removed, and two invitations no longer pending.
    await asOrganization(owner, ORG, async (run) => {
      await run(
        `UPDATE identity.membership SET status = 'removed', removed_at = now(), updated_at = now()
          WHERE account_id = (SELECT id FROM identity.account WHERE email = $1)`,
        [`filler-2@${FILLER_DOMAIN}`],
      );
      await run(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at, status, revoked_at)
         VALUES ($1, $2, 'editor', 'ro', sha256($3::bytea), now() + interval '7 days', 'revoked', now())`,
        [ORG, `revoked@${SUITE_DOMAIN}`, Buffer.from(randomUUID(), 'utf8')],
      );
      await run(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at, status, accepted_at)
         VALUES ($1, $2, 'editor', 'ro', sha256($3::bytea), now() + interval '7 days', 'accepted', now())`,
        [ORG, `accepted@${SUITE_DOMAIN}`, Buffer.from(randomUUID(), 'utf8')],
      );
    });

    // The administrator, two active members, a live invitation and a lapsed one.
    expect(await readSeats()).toEqual({ allowance: CEILING, used: 5 });

    // One statement behind the gates and the screen, and the rows the list publishes: if the count
    // and the union ever disagree about what a seat is, this is the assertion that says so.
    const list = await http().get('/api/v1/access?onpage=1').set(admin.authorization).expect(200);
    expect((list.body as { unfiltered: number }).unfiltered).toBe(5);
  });

  // ── The issue gate ────────────────────────────────────────────────────────────────────────────

  it('admits the invitation that takes the last seat', async () => {
    await fill(CEILING - 2);

    await invite(`tenth@${SUITE_DOMAIN}`).expect(201);

    expect(await readSeats()).toEqual({ allowance: CEILING, used: CEILING });
  });

  /**
   * UX-50's first three values on the wire, and the rollback proven rather than assumed: the gate
   * runs after the insert, so only the request transaction stands between a refusal and a stored
   * invitation, a queued email and a spent throttle budget.
   */
  it('refuses the invitation past the ceiling, stating the limit and what holds it, and leaves nothing behind', async () => {
    const address = `eleventh@${SUITE_DOMAIN}`;
    await fill(CEILING - 1);

    const res = await invite(address).expect(409);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: `${PROBLEM_BASE_URI}/entitlement-quota-exceeded`,
      limit: CEILING,
      used: CEILING,
    });
    expect((res.body as { detail?: string }).detail).toEqual(expect.any(String));

    expect(await invitationRows(address)).toEqual([]);
    expect(await queuedEmails(address)).toBe(0);
    expect(await attemptsNaming(address)).toBe(0);
    expect(await readSeats()).toEqual({ allowance: CEILING, used: CEILING });
  });

  it('holds a lapsed invitation’s seat until it is revoked', async () => {
    const address = `waiting@${SUITE_DOMAIN}`;
    await fill(CEILING - 2);
    const lapsed = await lapsedInvitation(`lapsed@${SUITE_DOMAIN}`);

    const refused = await invite(address).expect(409);
    expect((refused.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/entitlement-quota-exceeded`,
    );

    await http().delete(`/api/v1/invitations/${lapsed}`).set(admin.authorization).expect(204);
    await invite(address).expect(201);
  });

  it('refuses an address already outstanding as outstanding, even at the ceiling', async () => {
    const address = `twice@${SUITE_DOMAIN}`;
    await fill(CEILING - 2);
    await invite(address).expect(201);

    const res = await invite(address).expect(409);

    expect((res.body as { type: string }).type).toBe(`${PROBLEM_BASE_URI}/invitation-outstanding`);
  });

  /**
   * **The lock's test, on two real transactions interleaved by hand.** Without `holdSeatLock`, a
   * second invitation's count runs while the first is still uncommitted, sees ten — its own row and
   * the committed nine — and commits eleven. With it, the second count waits for the first
   * transaction to end and then sees both rows, which is what the gate refuses.
   *
   * **Two HTTP requests fired with `Promise.all` did not prove this, and the measurement is why the
   * case is shaped like this.** That version passed five runs of five with the lock deleted from the
   * repository, and five more with the stale throttle rows purged first — something on the request
   * path serialises two near-simultaneous invitations often enough that the race never opened. A
   * test that passes with its subject removed guards nothing, so the interleaving is now the test's
   * own rather than the scheduler's: the repository is driven through `INVITATION_STORE` inside two
   * request contexts, each on its own `esg_app` transaction with the organization bound, exactly as
   * `TenantTransactionGuard` would leave them.
   */
  it('makes a second seat-taking count wait until the first transaction ends', async () => {
    await fill(CEILING - 2);
    const store = app.get<InvitationStore>(INVITATION_STORE);

    const openTenantTransaction = async (): Promise<QueryRunner> => {
      const runner = application.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORG]);
      return runner;
    };
    const insertPending = (runner: QueryRunner, email: string) =>
      runner.query(
        `INSERT INTO identity.invitation
           (organization_id, invited_email, role, locale, token_hash, expires_at)
         VALUES ($1, $2, 'editor', 'ro', sha256($3::bytea), now() + interval '7 days')`,
        [ORG, email, Buffer.from(randomUUID(), 'utf8')],
      );
    const countUnderLock = (runner: QueryRunner) =>
      runInRequestContext(
        { correlationId: randomUUID(), locale: SOURCE_LOCALE, organizationId: ORG, queryRunner: runner },
        () => store.countSeatsHeldUnderLock(),
      );

    const first = await openTenantTransaction();
    const second = await openTenantTransaction();
    let timer: NodeJS.Timeout | undefined;
    try {
      await insertPending(first, `race-a@${SUITE_DOMAIN}`);
      expect(await countUnderLock(first)).toBe(CEILING);

      await insertPending(second, `race-b@${SUITE_DOMAIN}`);
      const secondCount = countUnderLock(second);
      // Swallowed on this copy only, so a failure above cannot leave an unhandled rejection behind.
      secondCount.catch(() => undefined);

      const STILL_WAITING = 'still waiting';
      const early = await Promise.race([
        secondCount,
        new Promise<string>((resolve) => {
          timer = setTimeout(() => resolve(STILL_WAITING), 500);
        }),
      ]);
      expect(early).toBe(STILL_WAITING);

      await first.commitTransaction();
      expect(await secondCount).toBe(CEILING + 1);
    } finally {
      clearTimeout(timer);
      if (first.isTransactionActive) await first.rollbackTransaction();
      if (second.isTransactionActive) await second.rollbackTransaction();
      await first.release();
      await second.release();
    }
  });

  // ── The acceptance gate ───────────────────────────────────────────────────────────────────────

  /** The invitation that filled the organization already holds the seat its acceptance keeps. */
  it('admits the person whose invitation filled the organization', async () => {
    await fill(CEILING - 2);
    await invite(EMAILS.admitted).expect(201);

    await accept(admitted, await tokenFor(EMAILS.admitted)).expect(201);

    expect(await readSeats()).toEqual({ allowance: CEILING, used: CEILING });
  });

  /**
   * Over the ceiling only because a member was added after the invitation went out — the state a
   * lowered ceiling leaves. The refusal must roll the acceptance back **whole**: the invitation still
   * pending, nobody joined, no throttle attempt, and the same link working once a seat is freed.
   */
  it('refuses an organization already over its ceiling, and the same link works once a seat is freed', async () => {
    await fill(CEILING - 2);
    await invite(EMAILS.overCeiling).expect(201);
    await fill(1);
    const token = await tokenFor(EMAILS.overCeiling);

    const refused = await accept(overCeiling, token).expect(409);

    expect((refused.body as { type: string }).type).toBe(
      `${PROBLEM_BASE_URI}/entitlement-quota-exceeded`,
    );
    // The invitee holds a link, not a membership: the organization's head count is not theirs to read.
    expect(refused.body).not.toHaveProperty('limit');
    expect(refused.body).not.toHaveProperty('used');
    expect(await invitationRows(EMAILS.overCeiling)).toEqual([{ status: 'pending' }]);
    expect(await attemptsNaming(overCeiling.accountId)).toBe(0);
    expect(await readSeats()).toEqual({ allowance: CEILING, used: CEILING + 1 });

    await freeOneSeat();
    await accept(overCeiling, token).expect(201);
  });
});

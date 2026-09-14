import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, databaseNow } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * Support access by the organization's consent, end to end (task 67.9; UC-85, UC-86; FR-77 … FR-79, FR-78 as
 * amended 14 Sep 2026; §12.5.6's task-67.9 row).
 *
 * What only this suite can prove: that **a request grants nothing** until an Organization Administrator of that
 * organization answers it; that the grant opens **the organization's own report reads, and exactly them**, to
 * the operator who asked and nobody else; that **every read is a log row written first**; that it ends when
 * either realm says so and **expires or lapses with nobody acting**; and that consent is **held by the
 * database's policies** — the platform's connection cannot write a grant, and the organization's reads its own
 * answers and never a platform read.
 *
 * **The tests run in order and share one story**, because the log is append-only and a request's state is folded
 * from its rows: the first request is raised, answered, read under and ended, and the later tests read what
 * that left behind. **Expiry and lapse are not waited for** — rows are written in the past, as the migration
 * owner, through the same policies the application meets.
 *
 * **Two organizations**: *Alfa* has an administrator, an editor and a report; *Beta* has only an administrator,
 * who is the stranger every refusal needs.
 */
const CHISINAU = 'Europe/Chisinau';
const RUN = `${process.pid}-${Date.now()}`;
const HOUR = 60 * 60 * 1000;

const TOKEN = `sa${Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('')}`;
const ALFA = { name: `Acces Alfa ${TOKEN}`, idno: `7${String(Date.now()).slice(-12)}` };
const BETA = { name: `Acces Beta ${TOKEN}`, idno: `8${String(Date.now()).slice(-12)}` };

const TICKET = 'SUP-4417';
const REASON = 'Proprietarul raportează că cifra pentru Scope 2 lipsește din export după recalculare.';

interface ShownRequest {
  id: string;
  organizationId: string;
  requesterEmail: string | null;
  ticketReference: string;
  reason: string;
  state: string;
  requestedAt: number;
  lapsesAt: number;
  grantedAt: number | null;
  expiresAt: number | null;
}

interface Shown {
  awaiting: ShownRequest[];
  active: ShownRequest | null;
}

interface LogDecision {
  kind: string;
  actorRealm: string;
  actorEmail: string | null;
  occurredAt: number;
}

interface LogEntry extends ShownRequest {
  requesterId: string;
  organizationName: string | null;
  decision: LogDecision | null;
  ended: LogDecision | null;
  accesses: { purpose: string; subject: string | null; occurredAt: number }[];
}

describe('support access by the organization’s consent (UC-85, UC-86; task 67.9)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let analyst: DataSource;

  let administrator: SignedInAccount;
  let editor: SignedInAccount;
  let stranger: SignedInAccount;
  let asker: SignedInOperator;
  let colleague: SignedInOperator;
  let billing: SignedInOperator;

  let alfaId: string;
  let betaId: string;
  let reportId: string;

  /** The request the story follows: raised, granted, read under, ended by a colleague. */
  let first: string;
  /** Granted, then ended by the organization. */
  let second: string;
  /** Declined. */
  let third: string;
  /** Written in the past: nobody answered it in 24 hours. */
  let lapsed: string;
  /** Written in the past: granted, and its 60 minutes ran out. */
  let expired: string;

  const http = () => request(app.getHttpServer());

  const typeOf = (response: { body: unknown }): string => (response.body as { type: string }).type;
  const objectOf = <T>(response: { body: unknown }): T => (response.body as { object: T }).object;
  const objectsOf = <T>(response: { body: unknown }): T[] => (response.body as { objects: T[] }).objects;

  const REQUIRED = () => problemTypeUri(ProblemType.SupportAccessRequired);
  const CONFLICT = () => problemTypeUri(ProblemType.Conflict);
  const INSUFFICIENT_ROLE = () => problemTypeUri(ProblemType.InsufficientRole);

  const raise = (
    operator: SignedInOperator,
    organizationId: string,
    body: { ticketReference: string; reason: string } = { ticketReference: TICKET, reason: REASON },
  ) =>
    http()
      .post('/api/v1/admin/support-access')
      .set(operator.cookie)
      .set('origin', ADMIN_ORIGIN)
      .send({ organizationId, ...body });

  const underGrant = (operator: SignedInOperator, organizationId: string, requestId: string, path = '') =>
    http()
      .get(`/api/v1/admin/organizations/${organizationId}/support-access/${requestId}/reports${path}`)
      .set(operator.cookie);

  const endAsOperator = (operator: SignedInOperator, organizationId: string, requestId: string) =>
    http()
      .post(`/api/v1/admin/organizations/${organizationId}/support-access/${requestId}/end`)
      .set(operator.cookie)
      .set('origin', ADMIN_ORIGIN)
      .send({});

  const answer = (member: SignedInAccount, requestId: string, verb: string) =>
    http().post(`/api/v1/support-access/${requestId}/${verb}`).set(member.authorization).send({});

  const shown = async (member: SignedInAccount): Promise<Shown> =>
    objectOf<Shown>(await http().get('/api/v1/support-access').set(member.authorization).expect(200));

  /** One entry of A-07's log, paged for rather than assumed on page one: earlier runs' rows stay, append-only. */
  const logEntry = async (operator: SignedInOperator, requestId: string): Promise<LogEntry> => {
    for (let page = 1; ; page += 1) {
      const response = await http().get(`/api/v1/admin/support-access?page=${page}`).set(operator.cookie).expect(200);
      const found = objectsOf<LogEntry>(response).find((entry) => entry.id === requestId);
      if (found) return found;
      if (page >= (response.body as { totalpages: number }).totalpages) {
        throw new Error(`request ${requestId} is not in the support access log`);
      }
    }
  };

  const accessRows = (requestId: string) =>
    analyst.query<{ purpose: string; subject: string | null }[]>(
      `SELECT purpose, subject FROM audit.support_access_log
        WHERE entry_kind = 'access' AND request_id = $1 ORDER BY occurred_at, id`,
      [requestId],
    );

  const auditRowsFor = (targetId: string) =>
    analyst.query<{ action: string; actor_id: string | null }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1 ORDER BY occurred_at, id`,
      [targetId],
    );

  /**
   * The id is generated here, not returned: `RETURNING` makes the new row pass the table's SELECT policies, and
   * with no organization bound it passes none (`organization-register.e2e-spec.ts` found it first).
   */
  const createOrganization = async (organization: { name: string; idno: string }): Promise<string> => {
    const id = randomUUID();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code, idno) VALUES ($1, $2, 'MD', $3)`, [
        id,
        organization.name,
        organization.idno,
      ]),
    );
    return id;
  };

  const grantMembership = (account: SignedInAccount, organizationId: string, role: string) =>
    asOrganization(owner, organizationId, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`, [
        account.accountId,
        organizationId,
        role,
      ]),
    );

  /**
   * A log row written some time ago, as the migration owner — **through the policies, not around them**: the
   * binding is set as the application would set it, so a row this cannot write is one no request could have
   * written either. The instant is the database's clock minus an interval, never a host `Date`.
   */
  const writeInThePast = async (row: {
    readonly ago: string;
    readonly kind: string;
    readonly id: string;
    readonly requestId: string | null;
    readonly requesterId: string;
    readonly organizationId: string;
    readonly boundOrganization: string | null;
    readonly actorId: string | null;
  }): Promise<void> => {
    const runner = owner.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `SELECT set_config('app.current_org', $1, true), set_config('app.current_user', $2, true)`,
        [row.boundOrganization ?? '', row.actorId ?? ''],
      );
      const isRequest = row.requestId === null;
      await runner.query(
        `INSERT INTO audit.support_access_log
           (id, occurred_at, entry_kind, request_id, requester_id, organization_id,
            actor_id, actor_realm, ticket_reference, reason)
         VALUES ($1, now() - $2::interval, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.id,
          row.ago,
          row.kind,
          row.requestId,
          row.requesterId,
          row.organizationId,
          row.actorId,
          isRequest ? null : 'organization',
          isRequest ? TICKET : null,
          isRequest ? REASON : null,
        ],
      );
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-support-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-support-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-support-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-support-analyst');

    alfaId = await createOrganization(ALFA);
    betaId = await createOrganization(BETA);

    const server = app.getHttpServer();
    administrator = await signInFreshAccount({ server, worker, email: `support-oa-${RUN}@support.test` });
    await grantMembership(administrator, alfaId, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    editor = await signInFreshAccount({ server, worker, email: `support-editor-${RUN}@support.test` });
    await grantMembership(editor, alfaId, MEMBERSHIP_ROLE.EDITOR);
    stranger = await signInFreshAccount({ server, worker, email: `support-stranger-${RUN}@support.test` });
    await grantMembership(stranger, betaId, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);

    const entity = await http()
      .post('/api/v1/entities')
      .set(administrator.authorization)
      .send({
        name: 'Brutăria Lina',
        legalForm: 'srl',
        naceCodes: ['10.71'],
        sites: [{ name: 'Brutăria Lina — sediu', locality: 'Chișinău', countryCode: 'MD' }],
      })
      .expect(201);
    const period = await http()
      .post('/api/v1/periods')
      .set(administrator.authorization)
      .send({
        reportingEntityId: objectOf<{ id: string }>(entity).id,
        fiscalYear: 2025,
        periodStart: { date: '2025-01-01', timezone: CHISINAU },
        periodEnd: { date: '2025-12-31', timezone: CHISINAU },
      })
      .expect(201);
    const report = await http()
      .post('/api/v1/reports')
      .set(administrator.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period).id })
      .expect(201);
    reportId = objectOf<{ id: string }>(report).id;

    asker = await signInOperator({
      server,
      application,
      email: `support-asker-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    colleague = await signInOperator({
      server,
      application,
      email: `support-colleague-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    billing = await signInOperator({
      server,
      application,
      email: `support-billing-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    // Entities, periods, reports and memberships cascade from the organization. The log's rows stay: it is
    // append-only, and that is the guarantee rather than a leak.
    for (const id of [alfaId, betaId].filter(Boolean)) {
      await asOrganization(owner, id, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [id]));
    }
    await app?.close();
    for (const source of [owner, worker, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('names the organization a request is about, from the register, and no organization that is not there', async () => {
    const row = objectOf<{ id: string; name: string }>(
      await http().get(`/api/v1/admin/organizations/${alfaId}`).set(asker.cookie).expect(200),
    );
    expect(row).toMatchObject({ id: alfaId, name: ALFA.name });

    const missing = await http().get(`/api/v1/admin/organizations/${randomUUID()}`).set(asker.cookie).expect(404);
    expect(typeOf(missing)).toBe(problemTypeUri(ProblemType.NotFound));
  });

  it('raises a request that grants nothing — 24 hours to answer, and a row in the system audit log', async () => {
    const raised = objectOf<{ id: string; organizationId: string; requestedAt: number; lapsesAt: number }>(
      await raise(asker, alfaId).expect(201),
    );
    first = raised.id;
    expect(raised.organizationId).toBe(alfaId);
    expect(raised.lapsesAt - raised.requestedAt).toBe(24 * HOUR);

    expect(typeOf(await underGrant(asker, alfaId, first).expect(403))).toBe(REQUIRED());
    expect(await accessRows(first)).toEqual([]);
    expect(await auditRowsFor(first)).toEqual([
      { action: 'admin.support_access.requested', actor_id: asker.accountId },
    ]);
  });

  it('refuses a second request while one waits, an organization that does not exist, and a request with no ticket', async () => {
    const outstanding = await raise(asker, alfaId).expect(409);
    expect(typeOf(outstanding)).toBe(problemTypeUri(ProblemType.SupportAccessOutstanding));

    const nowhere = await raise(asker, randomUUID()).expect(404);
    expect(typeOf(nowhere)).toBe(problemTypeUri(ProblemType.NotFound));

    await raise(asker, alfaId, { ticketReference: '   ', reason: REASON }).expect(400);
  });

  it('shows the request to the organization’s administrator, and to an editor or another organization nothing', async () => {
    const forAdministrator = await shown(administrator);
    expect(forAdministrator.active).toBeNull();
    expect(forAdministrator.awaiting).toEqual([
      expect.objectContaining({
        id: first,
        organizationId: alfaId,
        requesterEmail: asker.email,
        ticketReference: TICKET,
        reason: REASON,
        state: 'awaiting',
        grantedAt: null,
        expiresAt: null,
      }),
    ]);

    expect(await shown(editor)).toEqual({ awaiting: [], active: null });
    expect(await shown(stranger)).toEqual({ awaiting: [], active: null });
  });

  it('lets only an Organization Administrator of that organization answer it', async () => {
    expect(typeOf(await answer(editor, first, 'grant').expect(403))).toBe(INSUFFICIENT_ROLE());
    // Bound to their own organization, the request is not there at all — the log's select policy.
    const elsewhere = await answer(stranger, first, 'grant').expect(404);
    expect(typeOf(elsewhere)).toBe(problemTypeUri(ProblemType.NotFound));
  });

  it('grants: every member sees it running for 60 minutes, and the operator who asked reads what the organization reads', async () => {
    await answer(administrator, first, 'grant').expect(204);

    const running = (await shown(editor)).active;
    if (running?.grantedAt == null || running.expiresAt === null) throw new Error('the grant is not shown running');
    expect(running).toMatchObject({ id: first, state: 'active', requesterEmail: asker.email });
    expect(running.expiresAt - running.grantedAt).toBe(HOUR);
    expect(await shown(administrator)).toMatchObject({ awaiting: [], active: { id: first } });

    // Answered already.
    expect(typeOf(await answer(administrator, first, 'decline').expect(409))).toBe(CONFLICT());

    // The same three reads, as the organization's editor makes them and as the grant makes them: equal.
    const paths = ['', `/${reportId}/modules`, `/${reportId}/modules/B1`];
    for (const path of paths) {
      const asMember = await http().get(`/api/v1/reports${path}`).set(editor.authorization).expect(200);
      const asSupport = await underGrant(asker, alfaId, first, path).expect(200);
      expect(asSupport.body).toEqual(asMember.body);
    }
    expect(objectsOf<{ id: string }>(await underGrant(asker, alfaId, first).expect(200)).map((r) => r.id)).toEqual([
      reportId,
    ]);

    // Four reads, four rows, each naming what it opened.
    expect(await accessRows(first)).toEqual([
      { purpose: 'reports', subject: null },
      { purpose: 'report_modules', subject: reportId },
      { purpose: 'report_module', subject: `${reportId}/B1` },
      { purpose: 'reports', subject: null },
    ]);
  });

  it('refuses the reads to anybody but the operator who asked, and under any other organization — and logs no refused read', async () => {
    expect(typeOf(await underGrant(colleague, alfaId, first).expect(403))).toBe(REQUIRED());
    expect(typeOf(await underGrant(billing, alfaId, first).expect(403))).toBe(INSUFFICIENT_ROLE());
    // The same grant named under another organization is no grant: bound to Beta, the request is not there.
    expect(typeOf(await underGrant(asker, betaId, first).expect(403))).toBe(REQUIRED());
    // A tenant bearer is no credential here (NFR-65).
    await http()
      .get(`/api/v1/admin/organizations/${alfaId}/support-access/${first}/reports`)
      .set(administrator.authorization)
      .expect(401);

    expect(await accessRows(first)).toHaveLength(4);
  });

  it('ends when any Platform Administrator says so, and nothing more is read under it', async () => {
    await endAsOperator(colleague, alfaId, first).expect(204);

    expect(typeOf(await underGrant(asker, alfaId, first).expect(403))).toBe(REQUIRED());
    expect((await shown(editor)).active).toBeNull();
    expect(typeOf(await answer(administrator, first, 'end').expect(409))).toBe(CONFLICT());
    expect(typeOf(await endAsOperator(asker, alfaId, first).expect(409))).toBe(CONFLICT());

    expect(await auditRowsFor(first)).toEqual([
      { action: 'admin.support_access.requested', actor_id: asker.accountId },
      { action: 'admin.support_access.ended', actor_id: colleague.accountId },
    ]);
  });

  it('ends when the organization’s administrator says so, and not when an editor does', async () => {
    second = objectOf<{ id: string }>(await raise(asker, alfaId).expect(201)).id;
    await answer(administrator, second, 'grant').expect(204);

    expect(typeOf(await answer(editor, second, 'end').expect(403))).toBe(INSUFFICIENT_ROLE());
    await answer(administrator, second, 'end').expect(204);

    expect(typeOf(await underGrant(asker, alfaId, second).expect(403))).toBe(REQUIRED());
    expect((await shown(editor)).active).toBeNull();
  });

  it('declines: nothing is readable, and a declined request cannot be granted after', async () => {
    third = objectOf<{ id: string }>(await raise(asker, alfaId).expect(201)).id;
    await answer(administrator, third, 'decline').expect(204);

    expect(typeOf(await answer(administrator, third, 'grant').expect(409))).toBe(CONFLICT());
    expect(typeOf(await underGrant(asker, alfaId, third).expect(403))).toBe(REQUIRED());
    expect(await accessRows(third)).toEqual([]);
  });

  it('lapses a request nobody answers in 24 hours, and expires a grant after 60 minutes, with nobody acting', async () => {
    lapsed = randomUUID();
    await writeInThePast({
      ago: '25 hours',
      kind: 'request',
      id: lapsed,
      requestId: null,
      requesterId: colleague.accountId,
      organizationId: alfaId,
      boundOrganization: null,
      actorId: null,
    });

    expired = randomUUID();
    await writeInThePast({
      ago: '3 hours',
      kind: 'request',
      id: expired,
      requestId: null,
      requesterId: asker.accountId,
      organizationId: alfaId,
      boundOrganization: null,
      actorId: null,
    });
    await writeInThePast({
      ago: '2 hours',
      kind: 'grant',
      id: randomUUID(),
      requestId: expired,
      requesterId: asker.accountId,
      organizationId: alfaId,
      boundOrganization: alfaId,
      actorId: administrator.accountId,
    });

    expect((await shown(administrator)).awaiting).toEqual([]);
    expect(typeOf(await answer(administrator, lapsed, 'grant').expect(409))).toBe(CONFLICT());

    expect(typeOf(await underGrant(asker, alfaId, expired).expect(403))).toBe(REQUIRED());
    expect(typeOf(await answer(administrator, expired, 'end').expect(409))).toBe(CONFLICT());

    expect(await logEntry(colleague, lapsed)).toMatchObject({ state: 'lapsed', decision: null });
    expect(await logEntry(colleague, expired)).toMatchObject({
      state: 'expired',
      decision: { kind: 'grant', actorRealm: 'organization', actorEmail: administrator.email },
      ended: null,
    });
  });

  it('keeps the whole story in the log — who asked, who decided, how it ended, what was read — and logs reading it', async () => {
    const since = await databaseNow(analyst);

    const story = await logEntry(colleague, first);
    expect(story).toMatchObject({
      organizationId: alfaId,
      organizationName: ALFA.name,
      requesterId: asker.accountId,
      requesterEmail: asker.email,
      ticketReference: TICKET,
      reason: REASON,
      state: 'ended',
      decision: { kind: 'grant', actorRealm: 'organization', actorEmail: administrator.email },
      ended: { kind: 'end', actorRealm: 'platform', actorEmail: colleague.email },
    });
    expect(story.accesses.map((access) => [access.purpose, access.subject])).toEqual([
      ['reports', null],
      ['report_modules', reportId],
      ['report_module', `${reportId}/B1`],
      ['reports', null],
    ]);

    expect(await logEntry(colleague, second)).toMatchObject({
      state: 'ended',
      ended: { kind: 'end', actorRealm: 'organization', actorEmail: administrator.email },
    });
    expect(await logEntry(colleague, third)).toMatchObject({
      state: 'declined',
      decision: { kind: 'decline', actorEmail: administrator.email },
      ended: null,
      accesses: [],
    });

    const acquisitions = await analyst.query<{ purpose: string }[]>(
      `SELECT purpose FROM audit.support_access_log
        WHERE entry_kind = 'acquisition' AND requester_id = $1 AND occurred_at >= $2`,
      [colleague.accountId, since],
    );
    expect(acquisitions.length).toBeGreaterThan(0);
    expect(new Set(acquisitions.map((row) => row.purpose))).toEqual(new Set(['support_access_log']));
  });

  it('counts each operator’s requests of the last 30 days on A-08, whatever became of them', async () => {
    const roster = objectsOf<{ email: string; supportAccessRequests: number | null }>(
      await http().get('/api/v1/admin/accounts').set(colleague.cookie).expect(200),
    );
    const countOf = (email: string) => roster.find((row) => row.email === email)?.supportAccessRequests;

    // first, second, third and the expired one; the lapsed one; none.
    expect([countOf(asker.email), countOf(colleague.email), countOf(billing.email)]).toEqual([4, 1, 0]);
  });

  it('holds consent in the database: the organization reads only its own answers, and nobody unbound can write one', async () => {
    const kinds = await asOrganization(application, alfaId, (run) =>
      run(`SELECT DISTINCT entry_kind FROM audit.support_access_log WHERE organization_id = $1 ORDER BY 1`, [
        alfaId,
      ]),
    );
    // Never an access, never an acquisition — the platform's reads are not the organization's to browse.
    expect(kinds).toEqual([
      { entry_kind: 'decline' },
      { entry_kind: 'end' },
      { entry_kind: 'grant' },
      { entry_kind: 'request' },
    ]);

    const fromBeta = await asOrganization(application, betaId, (run) =>
      run(`SELECT count(*)::int AS n FROM audit.support_access_log WHERE organization_id = $1`, [alfaId]),
    );
    expect(fromBeta).toEqual([{ n: 0 }]);

    const grantRow = [randomUUID(), third, asker.accountId, alfaId, administrator.accountId];
    const insertGrant = `INSERT INTO audit.support_access_log
        (id, entry_kind, request_id, requester_id, organization_id, actor_id, actor_realm)
      VALUES ($1, 'grant', $2, $3, $4, $5, 'organization')`;

    // Unbound — the platform's own connection — a grant is refused outright.
    await expect(application.query(insertGrant, grantRow)).rejects.toThrow(/row-level security/u);
    // Bound to the organization but speaking for a member who is not the one bound: refused too.
    await expect(asOrganization(application, alfaId, (run) => run(insertGrant, grantRow))).rejects.toThrow(
      /row-level security/u,
    );
    // And nothing already written can be rewritten.
    await expect(
      asOrganization(application, alfaId, (run) => run(`UPDATE audit.support_access_log SET reason = reason`)),
    ).rejects.toThrow(/permission denied/u);
  });
});

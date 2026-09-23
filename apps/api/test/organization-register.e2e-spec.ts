import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { JwtAdminTokens } from '../src/infrastructure/adapters/token-signer/jwt-admin-tokens';
import { ADMIN_SESSION_COOKIE } from '../src/modules/platform/admin/constants/admin-session.constants';
import {
  sealAdminCookie,
  unsealAdminCookie,
  type AdminCookiePayload,
} from '../src/modules/platform/admin/domain/admin-cookie-codec';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, databaseNow, deleteHintsOf, required } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';
import {
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-02's register end to end (task 67.3; UC-69, FR-76, FR-77, FR-79) — through `AdminRealmGuard`,
 * read through `esg_admin_ro`, with the acquisition logged.
 *
 * What only this suite can prove: that the `SELECT` list is account-level metadata and nothing more,
 * against real rows; that the counts count what `design_spec.md` §5.2 says — **active** entities,
 * reports in any status, the sign-in of an **active** member; that search never becomes a wildcard;
 * and that the log row is really written, as the role the console uses to read it.
 *
 * **Two organizations, and the difference between them is the fixture.** *Alfa* has an administrator
 * who signed in, an entity, an archived entity, a report, and a removed member who signed in *more
 * recently* than the administrator — so each count has a row it must include and a row it must not.
 * *Beta* has nothing, which is what a new registration looks like.
 */
const CHISINAU = 'Europe/Chisinau';
const RUN = `${process.pid}-${Date.now()}`;

const randomOf = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

/** Letters only, so no search for an IDNO's digits can match a name by accident. */
const TOKEN = `rg${randomOf('abcdefghijklmnopqrstuvwxyz', 10)}`;
const IDNO_TAIL = randomOf('0123456789', 12);
const ALFA = { name: `Registru Alfa ${TOKEN}`, idno: `7${IDNO_TAIL}` };
const BETA = { name: `Registru Beta ${TOKEN}`, idno: `8${IDNO_TAIL}` };

interface RegisterRow {
  id: string;
  name: string;
  idno: string | null;
  registeredAt: number;
  entityCount: number;
  reportCount: number;
  lastSignInAt: number | null;
}

interface RegisterBody {
  objects: RegisterRow[];
  total: number;
  totalpages: number;
  unfiltered: number;
}

describe('the organization register (A-02, UC-69; task 67.3)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let analyst: DataSource;
  let tokens: JwtAdminTokens;

  let administrator: SignedInAccount;
  let platform: SignedInOperator;
  let billing: SignedInOperator;
  let alfaId: string;
  let betaId: string;

  const http = () => request(app.getHttpServer());

  const register = (headers: Record<string, string>, query = '') => {
    const call = http().get(`/api/v1/admin/organizations${query}`);
    for (const [header, value] of Object.entries(headers)) call.set(header, value);
    return call;
  };

  const bodyOf = (response: { body: unknown }): RegisterBody => response.body as RegisterBody;
  const idsOf = (response: { body: unknown }): string[] => bodyOf(response).objects.map((row) => row.id);
  const typeOf = (response: { body: unknown }): string => (response.body as { type: string }).type;

  /**
   * The id is generated here, not returned: `RETURNING` makes the new row pass the table's SELECT
   * policies, and with no organization bound it passes none — the insert is admitted and the
   * returning is refused, as this suite's first run found.
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

  const grant = async (account: SignedInAccount, role: string): Promise<string> => {
    const rows = (await asOrganization(owner, alfaId, (run) =>
      run(
        `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3) RETURNING id`,
        [account.accountId, alfaId, role],
      ),
    )) as { id: string }[];
    return rows[0].id;
  };

  const createEntity = async (name: string): Promise<string> => {
    const response = await http()
      .post('/api/v1/entities')
      .set(administrator.authorization)
      .send({
        name,
        legalForm: 'srl',
        naceCodes: ['10.71'],
        sites: [{ name: `${name} — sediu`, locality: 'Chișinău', countryCode: 'MD' }],
      })
      .expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-register-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-register-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-register-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-register-analyst');
    tokens = new JwtAdminTokens(required('AUTH_ADMIN_SECRET'));

    alfaId = await createOrganization(ALFA);
    betaId = await createOrganization(BETA);

    const server = app.getHttpServer();
    administrator = await signInFreshAccount({ server, worker, email: `register-oa-${RUN}@register.test` });
    await grant(administrator, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);

    // Signed in AFTER the administrator, so their session is the newest — and then removed. The
    // register's activity must stay the administrator's: a former member is not account activity.
    const former = await signInFreshAccount({ server, worker, email: `register-former-${RUN}@register.test` });
    const formerMembership = await grant(former, MEMBERSHIP_ROLE.EDITOR);
    await http()
      .delete(`/api/v1/members/${formerMembership}`)
      .set(administrator.authorization)
      .expect((response) => {
        if (response.status >= 300) throw new Error(`member removal answered ${response.status}`);
      });

    // One active entity carrying a period and a report, and one archived — which must not count.
    const kept = await createEntity('Brutăria Lina');
    const archived = await createEntity('Depozitul vechi');
    await http()
      .post(`/api/v1/entities/${archived}/archive`)
      .set(administrator.authorization)
      .send({})
      .expect((response) => {
        if (response.status >= 300) throw new Error(`archive answered ${response.status}`);
      });
    const period = await http()
      .post('/api/v1/periods')
      .set(administrator.authorization)
      .send({
        reportingEntityId: kept,
        fiscalYear: 2025,
        periodStart: { date: '2025-01-01', timezone: CHISINAU },
        periodEnd: { date: '2025-12-31', timezone: CHISINAU },
      })
      .expect(201);
    await http()
      .post('/api/v1/reports')
      .set(administrator.authorization)
      .send({ reportingPeriodId: (period.body as { object: { id: string } }).object.id })
      .expect(201);

    platform = await signInOperator({
      server,
      application,
      email: `register-pa-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    billing = await signInOperator({
      server,
      application,
      email: `register-bo-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    // The AD-15 hint its member removal committed (task 148); no worker drains it here.
    await deleteHintsOf({ owner, organizationIds: [alfaId, betaId].filter(Boolean) });
    // Entities, periods, reports and memberships cascade from the organization.
    for (const id of [alfaId, betaId].filter(Boolean)) {
      await asOrganization(owner, id, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [id]));
    }
    await app?.close();
    for (const source of [owner, worker, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('answers a Platform Administrator with account-level metadata, and nothing more', async () => {
    const response = await register(platform.cookie, `?search=${TOKEN}`).expect(200);
    const body = bodyOf(response);

    expect(body.total).toBe(2);
    expect(body.unfiltered).toBeGreaterThanOrEqual(2);

    const alfa = body.objects.find((row) => row.id === alfaId);
    const beta = body.objects.find((row) => row.id === betaId);
    if (!alfa || !beta) throw new Error('the register did not return both organizations');

    // The whole row, by key — a field added to the response is a question for design_spec §5.2, and
    // report content reaching this route would arrive as exactly such a field.
    expect(Object.keys(alfa).sort()).toEqual([
      'entityCount',
      'id',
      'idno',
      'lastSignInAt',
      'name',
      'registeredAt',
      'reportCount',
    ]);
    expect(alfa).toMatchObject({ name: ALFA.name, idno: ALFA.idno, entityCount: 1, reportCount: 1 });
    expect(beta).toMatchObject({ name: BETA.name, entityCount: 0, reportCount: 0, lastSignInAt: null });

    // Activity is the administrator's sign-in, not the removed member's later one — read from the
    // database's own record rather than a host clock.
    const [session] = await owner.query<{ at: Date }[]>(
      `SELECT max(created_at) AS at FROM identity.session WHERE account_id = $1`,
      [administrator.accountId],
    );
    expect(alfa.lastSignInAt).toBe(session.at.getTime());
  });

  it('searches the name anywhere, case-insensitively, and the IDNO as a prefix only', async () => {
    const byName = await register(platform.cookie, `?search=${encodeURIComponent(`ALFA ${TOKEN}`)}`).expect(200);
    expect(idsOf(byName)).toEqual([alfaId]);

    const byPrefix = await register(platform.cookie, `?search=${ALFA.idno.slice(0, 9)}`).expect(200);
    expect(idsOf(byPrefix)).toContain(alfaId);
    expect(idsOf(byPrefix)).not.toContain(betaId);

    // The same digits from the middle of the IDNO are not a prefix, so they find nothing of this run.
    const byTail = await register(platform.cookie, `?search=${ALFA.idno.slice(4)}`).expect(200);
    expect(idsOf(byTail)).not.toContain(alfaId);
  });

  it('reads a search’s wildcard characters as characters', async () => {
    const percent = await register(platform.cookie, `?search=${encodeURIComponent('%')}`).expect(200);
    expect(bodyOf(percent).total).toBe(0);
    expect(bodyOf(percent).unfiltered).toBeGreaterThan(0);

    // An underscore standing where the token has a letter: literal, it matches nothing; as a
    // wildcard, it would match both organizations.
    const underscore = `${TOKEN.slice(0, 4)}_${TOKEN.slice(5)}`;
    const response = await register(platform.cookie, `?search=${underscore}`).expect(200);
    expect(bodyOf(response).total).toBe(0);
  });

  it('orders by the column asked, and pages over the ordered set', async () => {
    const byEntities = await register(platform.cookie, `?search=${TOKEN}&order=entities,desc`).expect(200);
    expect(idsOf(byEntities)).toEqual([alfaId, betaId]);

    const byNameDescending = await register(platform.cookie, `?search=${TOKEN}&order=name,desc`).expect(200);
    expect(idsOf(byNameDescending)).toEqual([betaId, alfaId]);

    const secondPage = await register(platform.cookie, `?search=${TOKEN}&order=name,asc&onpage=1&page=2`).expect(200);
    expect(idsOf(secondPage)).toEqual([betaId]);
    expect(bodyOf(secondPage)).toMatchObject({ total: 2, totalpages: 2 });
  });

  it('refuses a Billing Operator, an anonymous caller and a tenant bearer', async () => {
    const operator = await register(billing.cookie).expect(403);
    expect(typeOf(operator)).toBe(problemTypeUri(ProblemType.InsufficientRole));

    const anonymous = await register({}).expect(401);
    expect(typeOf(anonymous)).toBe(problemTypeUri(ProblemType.AuthenticationRequired));

    // A valid tenant token is no credential here (NFR-65).
    const tenant = await register(administrator.authorization).expect(401);
    expect(typeOf(tenant)).toBe(problemTypeUri(ProblemType.AuthenticationRequired));
  });

  it('logs the acquisition before it reads, and a refused caller acquires nothing', async () => {
    const since = await databaseNow(analyst);
    await register(platform.cookie, `?search=${TOKEN}`).expect(200);

    const rows = await analyst.query<Record<string, unknown>[]>(
      `SELECT entry_kind, requester_id, organization_id, purpose
         FROM audit.support_access_log WHERE requester_id = $1 AND occurred_at >= $2`,
      [platform.accountId, since],
    );
    expect(rows).toEqual([
      {
        entry_kind: 'acquisition',
        requester_id: platform.accountId,
        organization_id: null,
        purpose: 'organization_register',
      },
    ]);

    await register(billing.cookie).expect(403);
    const [refused] = await analyst.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit.support_access_log WHERE requester_id = $1`,
      [billing.accountId],
    );
    expect(refused.n).toBe(0);
  });

  // Task 67.9 gave `esg_app` SELECT, for the organization's banner, and row security narrows it to the bound
  // organization's request, grant, decline and end rows — so with nothing bound, as here, the read is admitted and
  // sees nothing, the acquisitions this suite just wrote included. `support-access.e2e-spec.ts` owns the bound case.
  it('keeps the log out of the tenant tier’s reach — nothing visible unbound, and nothing rewritable', async () => {
    await expect(application.query(`SELECT 1 FROM audit.support_access_log LIMIT 1`)).resolves.toEqual([]);
    await expect(
      application.query(`UPDATE audit.support_access_log SET purpose = purpose`),
    ).rejects.toThrow(/permission denied/u);
  });

  // Last, because it consumes the operator's refresh token — the session itself stays live.
  it('rotates through the guard, re-setting the cookie on the register’s own response', async () => {
    const payload = unsealAdminCookie(platform.sealedSession, tokens.cookieKey());
    if (payload === null) throw new Error('the spec failed to unseal its own cookie');
    const aged: AdminCookiePayload = {
      ...payload,
      accessToken: await tokens.sign('spoofed-session-id', new Date(Date.now() - 60_000)),
    };

    const response = await http()
      .get('/api/v1/admin/organizations')
      .set('cookie', `${ADMIN_SESSION_COOKIE}=${sealAdminCookie(aged, tokens.cookieKey())}`)
      .expect(200);
    expect(String(response.headers['set-cookie'])).toContain(`${ADMIN_SESSION_COOKIE}=`);
  });
});

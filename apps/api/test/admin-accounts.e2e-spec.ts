import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_SESSION_COOKIE,
} from '../src/modules/platform/admin/constants/admin-session.constants';
import { totpCodeAt } from '../src/modules/platform/admin/domain/totp';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '../src/modules/platform/audit/models/audit-action.model';
import { connectAs } from './support/database';
import {
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-08 and A-20 over real HTTP (task 67.4; UC-87, UC-88, FR-80, FR-81, FR-159; §12.5.6's task-67.4
 * row) — invitation to account to sign-in, the lifecycle, the lockout release, and **one attributed
 * row in the system audit log per change**, read back both through the api and through the role the
 * api reads it with.
 */
const RUN = `${process.pid}-${Date.now()}`;
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3200';
const PASSWORD = 'Parola123!';
const address = (label: string) => `admin-accounts-${label}-${RUN}@easyesg.md`;

interface RosterRow {
  id: string;
  kind: string;
  email: string;
  role: string;
  standing: string;
  lastSignInAt: number | null;
  expiresAt: number | null;
}

interface LogEntry {
  id: string;
  occurredAt: number;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetId: string | null;
  targetEmail: string | null;
}

const cookieValue = (response: request.Response, name: string): string => {
  const header = ([] as string[]).concat(response.headers['set-cookie'] as unknown as string[]).join('\n');
  const match = new RegExp(`${name}=([^;]*)`, 'u').exec(header);
  if (!match?.[1]) throw new Error(`no ${name} cookie on the response`);
  return match[1];
};

describe('administrator accounts and the system audit log (A-08, A-20; task 67.4)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let adminReader: DataSource;
  let platform: SignedInOperator;
  let colleague: SignedInOperator;
  let billing: SignedInOperator;

  const http = () => request(app.getHttpServer());
  const asPlatform = (call: request.Test) => call.set(platform.cookie).set('origin', ADMIN_ORIGIN);

  /** The raw token lives in one durable place, the outbox payload (OQ-54) — the email's link. */
  const tokenFor = async (invitationId: string): Promise<string> => {
    const rows = await owner.query<{ token: string }[]>(
      `SELECT payload->>'token' AS token FROM audit.outbox_event
        WHERE event_type = 'platform.admin_invitation.issued' AND payload->>'invitationId' = $1
        ORDER BY occurred_at DESC, id DESC LIMIT 1`,
      [invitationId],
    );
    if (rows.length === 0) throw new Error(`no invitation email for ${invitationId}`);
    return rows[0].token;
  };

  /** Rows written for a target, read as the role A-08 reads the log with — platform rows are invisible to `esg_app`. */
  const auditRowsFor = (targetId: string) =>
    adminReader.query<{ action: string; actor_id: string | null }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1 ORDER BY occurred_at, id`,
      [targetId],
    );

  const invite = async (email: string, role: string = ADMIN_ROLE.BILLING_OPERATOR) =>
    asPlatform(http().post('/api/v1/admin/invitations')).send({ email, role }).expect(201);

  const roster = async (): Promise<RosterRow[]> =>
    ((await asPlatform(http().get('/api/v1/admin/accounts')).expect(200)).body as { objects: RosterRow[] })
      .objects;

  const accept = async (token: string): Promise<{ email: string; secret: string }> => {
    const enrolment = await http()
      .post('/api/v1/auth/admin/invitation/enrolment')
      .set('origin', ADMIN_ORIGIN)
      .send({ token })
      .expect(200);
    const { secret } = (enrolment.body as { object: { secret: string } }).object;

    const accepted = await http()
      .post('/api/v1/auth/admin/invitation/acceptance')
      .set('origin', ADMIN_ORIGIN)
      .send({ token, password: PASSWORD, totpCode: totpCodeAt(secret, new Date()) })
      .expect(201);
    return { email: (accepted.body as { object: { email: string } }).object.email, secret };
  };

  const signIn = async (input: { email: string; secret: string }) => {
    const opened = await http()
      .post('/api/v1/auth/admin/session/challenge')
      .set('origin', ADMIN_ORIGIN)
      .send({ email: input.email, password: PASSWORD })
      .expect(201);
    const signedIn = await http()
      .post('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .set('cookie', `${ADMIN_CHALLENGE_COOKIE}=${cookieValue(opened, ADMIN_CHALLENGE_COOKIE)}`)
      .send({ totpCode: totpCodeAt(input.secret, new Date()) })
      .expect(201);
    return { cookie: `${ADMIN_SESSION_COOKIE}=${cookieValue(signedIn, ADMIN_SESSION_COOKIE)}` };
  };

  const drainBearerWindow = () =>
    owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE 'admin-invitation:%'`);

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-admin-accounts-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-admin-accounts-app');
    adminReader = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-admin-accounts-ro');
    await drainBearerWindow();

    const server = app.getHttpServer();
    platform = await signInOperator({
      server,
      application,
      email: address('pa'),
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    colleague = await signInOperator({
      server,
      application,
      email: address('pa-colleague'),
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    billing = await signInOperator({
      server,
      application,
      email: address('bo'),
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
  }, 120_000);

  afterAll(async () => {
    const pattern = `admin-accounts-%-${RUN}@easyesg.md`;
    await owner?.query(
      `DELETE FROM audit.outbox_event
        WHERE event_type = 'platform.admin_invitation.issued' AND payload->>'email' LIKE $1`,
      [pattern],
    );
    await owner?.query(`DELETE FROM identity.admin_invitation WHERE email LIKE $1`, [pattern]);
    await owner?.query(`DELETE FROM identity.admin_account WHERE email LIKE $1`, [pattern]);
    await drainBearerWindow();
    if (owner) await cleanupSignedInOperators({ owner });
    for (const source of [owner, application, adminReader]) {
      if (source?.isInitialized) await source.destroy();
    }
    await app?.close();
  });

  it('turns an invitation into an account that signs in, and records who invited and who accepted', async () => {
    const email = address('invitee');
    const issued = await invite(email);
    const invitationId = (issued.body as { object: { id: string; expiresAt: number } }).object.id;

    expect((await roster()).find((row) => row.id === invitationId)).toMatchObject({
      kind: 'invitation',
      standing: 'invited',
      role: 'billing_operator',
    });

    const token = await tokenFor(invitationId);
    const preview = await http()
      .post('/api/v1/auth/admin/invitation/preview')
      .set('origin', ADMIN_ORIGIN)
      .send({ token })
      .expect(200);
    expect((preview.body as { object: unknown }).object).toMatchObject({ email, role: 'billing_operator' });

    const credentials = await accept(token);
    expect(credentials.email).toBe(email);

    // The new operator signs in through the real handshake, with the password and factor just set.
    const session = await signIn(credentials);
    await http().get('/api/v1/auth/admin/session').set('cookie', session.cookie).expect(200);

    const account = (await roster()).find((row) => row.kind === 'account' && row.email === email);
    expect(account).toMatchObject({ standing: 'active', role: 'billing_operator' });
    expect(account?.lastSignInAt).not.toBeNull();

    // One row for the issue, by the inviter; one for the acceptance, by the account it created.
    const rows = await auditRowsFor(invitationId);
    expect(rows).toEqual([
      { action: AUDIT_ACTION.ADMIN_INVITATION_ISSUED, actor_id: platform.accountId },
      { action: AUDIT_ACTION.ADMIN_INVITATION_ACCEPTED, actor_id: account?.id },
    ]);

    // The link is spent.
    const reused = await http()
      .post('/api/v1/auth/admin/invitation/preview')
      .set('origin', ADMIN_ORIGIN)
      .send({ token })
      .expect(410);
    expect((reused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InvitationNotAcceptable));
  });

  it('replaces the link on a resend, and a revoked invitation’s link says it was withdrawn', async () => {
    const issued = await invite(address('resent'));
    const invitationId = (issued.body as { object: { id: string } }).object.id;
    const first = await tokenFor(invitationId);

    await asPlatform(http().post(`/api/v1/admin/invitations/${invitationId}/email`)).expect(204);
    const second = await tokenFor(invitationId);
    expect(second).not.toBe(first);

    const preview = (token: string) =>
      http().post('/api/v1/auth/admin/invitation/preview').set('origin', ADMIN_ORIGIN).send({ token });
    await preview(first).expect(410);
    await preview(second).expect(200);

    await asPlatform(http().delete(`/api/v1/admin/invitations/${invitationId}`)).expect(204);
    const withdrawn = await preview(second).expect(410);
    expect((withdrawn.body as { standing?: string }).standing).toBe('revoked');
    await asPlatform(http().post(`/api/v1/admin/invitations/${invitationId}/email`)).expect(404);

    expect((await auditRowsFor(invitationId)).map((row) => row.action)).toEqual([
      AUDIT_ACTION.ADMIN_INVITATION_ISSUED,
      AUDIT_ACTION.ADMIN_INVITATION_RESENT,
      AUDIT_ACTION.ADMIN_INVITATION_REVOKED,
    ]);
    await drainBearerWindow();
  });

  it('refuses an invitation to an address an account holds, and a second pending one', async () => {
    const taken = await asPlatform(http().post('/api/v1/admin/invitations'))
      .send({ email: billing.email, role: ADMIN_ROLE.BILLING_OPERATOR })
      .expect(409);
    expect((taken.body as { type: string }).type).toBe(problemTypeUri(ProblemType.AdminAccountExists));

    const email = address('twice');
    await invite(email);
    const outstanding = await asPlatform(http().post('/api/v1/admin/invitations'))
      .send({ email, role: ADMIN_ROLE.BILLING_OPERATOR })
      .expect(409);
    expect((outstanding.body as { type: string }).type).toBe(
      problemTypeUri(ProblemType.InvitationOutstanding),
    );
  });

  it('suspends an operator, whose session is refused on its next request and not revived by reactivation', async () => {
    const path = `/api/v1/admin/accounts/${billing.accountId}`;
    await http().get('/api/v1/auth/admin/session').set(billing.cookie).expect(200);

    await asPlatform(http().post(`${path}/suspension`)).expect(204);
    await http().get('/api/v1/auth/admin/session').set(billing.cookie).expect(401);
    expect((await roster()).find((row) => row.id === billing.accountId)?.standing).toBe('suspended');

    await asPlatform(http().post(`${path}/reactivation`)).expect(204);
    await http().get('/api/v1/auth/admin/session').set(billing.cookie).expect(401);
    expect((await roster()).find((row) => row.id === billing.accountId)?.standing).toBe('active');

    const already = await asPlatform(http().post(`${path}/reactivation`)).expect(409);
    expect((already.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));

    expect(await auditRowsFor(billing.accountId)).toEqual([
      { action: AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED, actor_id: platform.accountId },
      { action: AUDIT_ACTION.ADMIN_ACCOUNT_REACTIVATED, actor_id: platform.accountId },
    ]);
  });

  it('refuses an operator acting on their own account, and writes nothing for the refusal', async () => {
    const own = await asPlatform(http().post(`/api/v1/admin/accounts/${platform.accountId}/suspension`)).expect(409);
    expect((own.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));
    expect(await auditRowsFor(platform.accountId)).toEqual([]);
  });

  it('releases a lockout once, and refuses a release on an account that is not locked', async () => {
    await owner.query(
      `UPDATE identity.admin_account SET locked_at = now(), failed_attempts = 10 WHERE id = $1`,
      [colleague.accountId],
    );

    await asPlatform(http().post(`/api/v1/admin/accounts/${colleague.accountId}/lockout-release`)).expect(204);

    const [released] = await owner.query<{ locked_at: Date | null; failed_attempts: number }[]>(
      `SELECT locked_at, failed_attempts FROM identity.admin_account WHERE id = $1`,
      [colleague.accountId],
    );
    expect(released).toEqual({ locked_at: null, failed_attempts: 0 });

    await asPlatform(http().post(`/api/v1/admin/accounts/${colleague.accountId}/lockout-release`)).expect(409);
    expect(await auditRowsFor(colleague.accountId)).toEqual([
      { action: AUDIT_ACTION.ADMIN_ACCOUNT_LOCKOUT_RELEASED, actor_id: platform.accountId },
    ]);
  });

  it('removes an account finally — and its address can be invited again as a new account', async () => {
    const email = address('removed');
    const issued = await invite(email);
    const credentials = await accept(await tokenFor((issued.body as { object: { id: string } }).object.id));
    const account = (await roster()).find((row) => row.kind === 'account' && row.email === credentials.email);
    if (account === undefined) throw new Error('the accepted account is not on the roster');

    await asPlatform(http().post(`/api/v1/admin/accounts/${account.id}/removal`)).expect(204);
    await asPlatform(http().post(`/api/v1/admin/accounts/${account.id}/reactivation`)).expect(409);
    await http()
      .post('/api/v1/auth/admin/session/challenge')
      .set('origin', ADMIN_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(401);

    await invite(email);
    const standings = (await roster()).filter((row) => row.email === email).map((row) => row.standing);
    expect(standings).toEqual(['invited', 'removed']);
  });

  it('refuses a write from another origin before it reaches the realm guard', async () => {
    await http()
      .post('/api/v1/admin/invitations')
      .set(platform.cookie)
      .set('origin', 'https://elsewhere.example')
      .send({ email: address('elsewhere'), role: ADMIN_ROLE.BILLING_OPERATOR })
      .expect(403);
  });

  it('bounds link guessing per address: five unknown links, then the window refuses without counting', async () => {
    await drainBearerWindow();
    const guess = (n: number) =>
      http()
        .post('/api/v1/auth/admin/invitation/preview')
        .set('origin', ADMIN_ORIGIN)
        .send({ token: `not-a-token-${RUN}-${n}` });

    for (let n = 0; n < 5; n += 1) await guess(n).expect(410);
    const refused = await guess(5).expect(429);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.RateLimited));
    await drainBearerWindow();
  });

  it('reads the log newest first, filtered by operator and action, and logs that reading it acquired the bypass role', async () => {
    const before = await adminReader.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit.support_access_log
        WHERE requester_id = $1 AND purpose = 'system_audit_log'`,
      [platform.accountId],
    );

    const page = await asPlatform(
      http().get('/api/v1/admin/audit-log').query({
        operator: platform.accountId,
        action: AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED,
      }),
    ).expect(200);
    const body = page.body as { objects: LogEntry[]; total: number; unfiltered: number };

    expect(body.objects).toHaveLength(1);
    expect(body.objects[0]).toMatchObject({
      action: AUDIT_ACTION.ADMIN_ACCOUNT_SUSPENDED,
      actorId: platform.accountId,
      actorEmail: platform.email,
      targetId: billing.accountId,
      targetEmail: billing.email,
    });
    expect(body.unfiltered).toBeGreaterThanOrEqual(body.total);

    const newestFirst = (
      (await asPlatform(http().get('/api/v1/admin/audit-log').query({ operator: platform.accountId })).expect(200))
        .body as { objects: LogEntry[] }
    ).objects.map((entry) => entry.occurredAt);
    expect(newestFirst).toEqual([...newestFirst].sort((a, b) => b - a));

    const after = await adminReader.query<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM audit.support_access_log
        WHERE requester_id = $1 AND purpose = 'system_audit_log'`,
      [platform.accountId],
    );
    expect(after[0].n).toBe(before[0].n + 2);
  });

  it('refuses a Billing Operator the roster and the log alike', async () => {
    const session = await signInOperator({
      server: app.getHttpServer(),
      application,
      email: address('bo-reader'),
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
    for (const path of ['/api/v1/admin/accounts', '/api/v1/admin/audit-log']) {
      const refused = await http().get(path).set(session.cookie).expect(403);
      expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InsufficientRole));
    }
  });
});

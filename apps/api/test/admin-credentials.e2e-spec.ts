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
import { ADMIN_ROLE, type AdminRole } from '../src/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '../src/modules/platform/audit/models/audit-action.model';
import { connectAs } from './support/database';
import {
  OPERATOR_PASSWORD,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A-19's api and A-01's recovery sign-in, end to end (task 144; UC-212, FR-80; `architecture.md` §12.5.6's
 * task-144 row).
 *
 * What only this suite can prove beyond the use-case specs: that a recovery code minted over HTTP opens a
 * real session and is spent in the database exactly once; that the recovery route reaches an account the
 * handshake refuses as locked, and releases it; that a re-enrolment changes which authenticator the real
 * handshake accepts, and only once confirmed; that a password change ends the other sessions on their next
 * request and spares the one that asked; that the staged secret is sealed at rest; and that each write lands
 * in the system audit log against the operator's own account.
 *
 * **One operator per test**, because the handshake spends §12.5.6's sign-in window twice per sign-in, and a
 * suite sharing one address would exhaust it by the third test.
 */
const RUN = `${process.pid}-${Date.now()}`;

/** The console origin the api's Origin proof admits on the realm's writes. */
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3200';

/** `signInOperator`'s pinned secret — the authenticator every operator it provisions starts with. */
const PROVISIONED_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const REPLACEMENT_PASSWORD = 'ParolaNoua9?';

const objectOf = <T>(response: request.Response): T => (response.body as { object: T }).object;

const typeOf = (response: request.Response): string => (response.body as { type?: string }).type ?? '';

const cookieValue = (response: request.Response, name: string): string => {
  const header = ([] as string[]).concat(response.headers['set-cookie'] as unknown as string[]).join('\n');
  const match = new RegExp(`${name}=([^;]*)`, 'u').exec(header);
  if (!match?.[1]) throw new Error(`no ${name} cookie on the response`);
  return match[1];
};

const codeFor = (secret: string): string => {
  const code = totpCodeAt(secret, new Date());
  if (code === null) throw new Error('the secret failed to decode');
  return code;
};

interface AuditRow {
  action: string;
  actor_id: string | null;
  target_id: string | null;
}

describe('the operator’s own credentials and the recovery sign-in (A-19, UC-212; task 144)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  /** `esg_admin_ro` — a platform audit row is invisible to every other role (`apps/api/CLAUDE.md`). */
  let analyst: DataSource;
  const accountIds: string[] = [];

  const server = () => app.getHttpServer();

  const operator = async (label: string, role: AdminRole = ADMIN_ROLE.PLATFORM_ADMINISTRATOR) => {
    const signedIn: SignedInOperator = await signInOperator({
      server: server(),
      application,
      email: `task144-${label}-${RUN}@easyesg.md`,
      role,
    });
    accountIds.push(signedIn.accountId);
    return signedIn;
  };

  const write = (path: string, session: { cookie: string }) =>
    request(server()).post(`/api/v1${path}`).set('origin', ADMIN_ORIGIN).set(session);

  const issueCodes = async (session: { cookie: string }): Promise<string[]> =>
    objectOf<{ recoveryCodes: string[] }>(
      await write('/admin/credentials/recovery-codes', session).send({ password: OPERATOR_PASSWORD }).expect(201),
    ).recoveryCodes;

  const recover = (body: { email: string; password: string; recoveryCode: string }) =>
    request(server()).post('/api/v1/auth/admin/session/recovery').set('origin', ADMIN_ORIGIN).send(body);

  const openChallenge = (email: string, password: string) =>
    request(server())
      .post('/api/v1/auth/admin/session/challenge')
      .set('origin', ADMIN_ORIGIN)
      .send({ email, password });

  const answerFactor = (challenge: request.Response, code: string) =>
    request(server())
      .post('/api/v1/auth/admin/session')
      .set('origin', ADMIN_ORIGIN)
      .set('cookie', `${ADMIN_CHALLENGE_COOKIE}=${cookieValue(challenge, ADMIN_CHALLENGE_COOKIE)}`)
      .send({ totpCode: code });

  const sessionOf = (response: request.Response) => ({
    cookie: `${ADMIN_SESSION_COOKIE}=${cookieValue(response, ADMIN_SESSION_COOKIE)}`,
  });

  const probe = (session: { cookie: string }) =>
    request(server()).get('/api/v1/auth/admin/session').set(session);

  const auditRowsFor = (accountId: string) =>
    analyst.query<AuditRow[]>(
      `SELECT action, actor_id, target_id FROM audit.system_audit_log
        WHERE actor_id = $1 ORDER BY occurred_at, id`,
      [accountId],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-admin-credentials-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-admin-credentials-app');
    analyst = await connectAs(
      'DB_ADMIN_RO_USER',
      'DB_ADMIN_RO_PASSWORD',
      'easyesg-admin-credentials-analyst',
    );
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInOperators({ owner });
    // The re-authentication window is keyed on the account, which the helper's drain by address cannot match.
    if (accountIds.length > 0) {
      await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE ANY($1)`, [
        accountIds.map((id) => `admin-reauthentication:%:${id}`),
      ]);
    }
    for (const source of [owner, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
    await app?.close();
  });

  it('reads that no codes exist, issues ten shown once, and reads back when and how many', async () => {
    const pa = await operator('issue');

    const before = await request(server()).get('/api/v1/admin/credentials').set(pa.cookie).expect(200);
    expect(objectOf(before)).toEqual({ recoveryCodesIssuedAt: null, recoveryCodesRemaining: 0 });

    const refused = await write('/admin/credentials/recovery-codes', pa.cookie)
      .send({ password: 'Gresita1!' })
      .expect(403);
    expect(typeOf(refused)).toBe(problemTypeUri(ProblemType.CredentialInvalid));

    const codes = await issueCodes(pa.cookie);
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(/^[0-9A-Z]{4}(?:-[0-9A-Z]{4}){3}$/u);

    const after = objectOf<{ recoveryCodesIssuedAt: number | null; recoveryCodesRemaining: number }>(
      await request(server()).get('/api/v1/admin/credentials').set(pa.cookie).expect(200),
    );
    expect(after.recoveryCodesRemaining).toBe(10);
    expect(after.recoveryCodesIssuedAt).toEqual(expect.any(Number));

    // Digests only — thirty-two bytes each, and none of them a code the response printed.
    const stored = await owner.query<{ code_hash: Buffer }[]>(
      `SELECT code_hash FROM identity.admin_recovery_code WHERE account_id = $1`,
      [pa.accountId],
    );
    expect(stored.map(({ code_hash }) => code_hash.length)).toEqual(Array(10).fill(32));

    // One row for the issue, and none for the refusal before it — a refusal is not a change.
    const issued = (await auditRowsFor(pa.accountId)).filter(
      (row) => row.action === AUDIT_ACTION.ADMIN_RECOVERY_CODES_ISSUED,
    );
    expect(issued).toEqual([
      { action: AUDIT_ACTION.ADMIN_RECOVERY_CODES_ISSUED, actor_id: pa.accountId, target_id: pa.accountId },
    ]);
  });

  it('signs a Billing Operator in with the password and a recovery code — and spends that code exactly once', async () => {
    const bo = await operator('recover', ADMIN_ROLE.BILLING_OPERATOR);
    const codes = await issueCodes(bo.cookie);

    // The address in capitals and the code in lower case: both normalise to what is stored.
    const attempt = () =>
      recover({ email: bo.email.toUpperCase(), password: OPERATOR_PASSWORD, recoveryCode: codes[0].toLowerCase() });

    const recovered = await attempt().expect(201);
    const body = objectOf<{ account: { id: string }; recoveryCodesRemaining: number }>(recovered);
    expect(body).toMatchObject({ account: { id: bo.accountId }, recoveryCodesRemaining: 9 });
    // The session rides the cookie, as the handshake's does; no token reaches a body.
    expect(JSON.stringify(recovered.body)).not.toMatch(/token/iu);
    await probe(sessionOf(recovered)).expect(200);

    const again = await attempt().expect(401);
    expect(typeOf(again)).toBe(problemTypeUri(ProblemType.CredentialInvalid));

    const [spent] = await owner.query<{ spent: number }[]>(
      `SELECT count(*)::int AS spent FROM identity.admin_recovery_code
        WHERE account_id = $1 AND spent_at IS NOT NULL`,
      [bo.accountId],
    );
    expect(spent.spent).toBe(1);

    const actions = (await auditRowsFor(bo.accountId)).map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERED, AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERY_REFUSED]),
    );
  });

  it('reaches an account the handshake refuses as locked and releases it, where a wrong code releases nothing', async () => {
    const pa = await operator('locked');
    const codes = await issueCodes(pa.cookie);
    await owner.query(
      `UPDATE identity.admin_account SET locked_at = now(), failed_attempts = 10 WHERE id = $1`,
      [pa.accountId],
    );

    const blocked = await openChallenge(pa.email, OPERATOR_PASSWORD).expect(403);
    expect(typeOf(blocked)).toBe(problemTypeUri(ProblemType.AdminAccountLocked));

    await recover({ email: pa.email, password: OPERATOR_PASSWORD, recoveryCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' }).expect(401);
    const [stillLocked] = await owner.query<{ locked: boolean }[]>(
      `SELECT locked_at IS NOT NULL AS locked FROM identity.admin_account WHERE id = $1`,
      [pa.accountId],
    );
    expect(stillLocked.locked).toBe(true);

    await recover({ email: pa.email, password: OPERATOR_PASSWORD, recoveryCode: codes[0] }).expect(201);
    const [released] = await owner.query<{ locked_at: Date | null; failed_attempts: number }[]>(
      `SELECT locked_at, failed_attempts FROM identity.admin_account WHERE id = $1`,
      [pa.accountId],
    );
    expect(released).toEqual({ locked_at: null, failed_attempts: 0 });

    await openChallenge(pa.email, OPERATOR_PASSWORD).expect(201);
  });

  it('changes the password, ending the other sessions on their next request and sparing the one that asked', async () => {
    const pa = await operator('password');
    const challenge = await openChallenge(pa.email, OPERATOR_PASSWORD).expect(201);
    const second = sessionOf(await answerFactor(challenge, codeFor(PROVISIONED_SECRET)).expect(201));

    const wrong = await write('/admin/credentials/password', pa.cookie)
      .send({ currentPassword: 'Gresita1!', password: REPLACEMENT_PASSWORD })
      .expect(403);
    expect(typeOf(wrong)).toBe(problemTypeUri(ProblemType.CredentialInvalid));

    const changed = await write('/admin/credentials/password', pa.cookie)
      .send({ currentPassword: OPERATOR_PASSWORD, password: REPLACEMENT_PASSWORD, terminateOtherSessions: true })
      .expect(200);
    expect(objectOf(changed)).toEqual({ otherSessionsTerminated: 1 });

    await probe(pa.cookie).expect(200);
    await probe(second).expect(401);
    const sessions = await owner.query<{ revoked_reason: string | null }[]>(
      `SELECT revoked_reason FROM identity.admin_session WHERE account_id = $1 ORDER BY created_at`,
      [pa.accountId],
    );
    expect(sessions.map((session) => session.revoked_reason)).toEqual([null, 'password_changed']);

    // Four handshake steps have spent most of §12.5.6's window for this address, and the two sign-ins below
    // are the assertion — so the window is drained rather than the checks dropped.
    await owner.query(`DELETE FROM identity.auth_attempt WHERE attempt_key LIKE $1`, [
      `admin-sign-in:%:${pa.email}`,
    ]);
    await openChallenge(pa.email, OPERATOR_PASSWORD).expect(401);
    await openChallenge(pa.email, REPLACEMENT_PASSWORD).expect(201);

    expect(await auditRowsFor(pa.accountId)).toContainEqual({
      action: AUDIT_ACTION.ADMIN_PASSWORD_CHANGED,
      actor_id: pa.accountId,
      target_id: pa.accountId,
    });
  });

  it('re-enrols the second factor: the new authenticator counts only once confirmed with the password, and the old one stops', async () => {
    const pa = await operator('reenrol');

    const offer = objectOf<{ secret: string; uri: string }>(
      await write('/admin/credentials/totp/enrolment', pa.cookie).send({ password: OPERATOR_PASSWORD }).expect(201),
    );
    expect(offer.uri).toContain(offer.secret);

    // Sealed at rest, as the factor in force is.
    const [staged] = await owner.query<{ staged: string }[]>(
      `SELECT staged_totp_secret AS staged FROM identity.admin_account WHERE id = $1`,
      [pa.accountId],
    );
    expect(staged.staged).toMatch(/^v\d+\./u);
    expect(staged.staged).not.toContain(offer.secret);

    const confirm = (body: { password: string; code: string }) =>
      write('/admin/credentials/totp/confirmation', pa.cookie).send(body);

    const withoutPassword = await confirm({ password: 'Gresita1!', code: codeFor(offer.secret) }).expect(403);
    expect(typeOf(withoutPassword)).toBe(problemTypeUri(ProblemType.CredentialInvalid));
    const wrongCode = await confirm({ password: OPERATOR_PASSWORD, code: 'ABCDEF' }).expect(403);
    expect(typeOf(wrongCode)).toBe(problemTypeUri(ProblemType.FactorInvalid));
    await confirm({ password: OPERATOR_PASSWORD, code: codeFor(offer.secret) }).expect(204);

    const [after] = await owner.query<{ staged: string | null }[]>(
      `SELECT staged_totp_secret AS staged FROM identity.admin_account WHERE id = $1`,
      [pa.accountId],
    );
    expect(after.staged).toBeNull();

    // One challenge, two answers: a wrong code leaves the challenge open for a retype.
    const challenge = await openChallenge(pa.email, OPERATOR_PASSWORD).expect(201);
    const old = await answerFactor(challenge, codeFor(PROVISIONED_SECRET)).expect(401);
    expect(typeOf(old)).toBe(problemTypeUri(ProblemType.FactorInvalid));
    await answerFactor(challenge, codeFor(offer.secret)).expect(201);

    const rows = await auditRowsFor(pa.accountId);
    expect(rows).toContainEqual({
      action: AUDIT_ACTION.ADMIN_FACTOR_REENROLMENT_STARTED,
      actor_id: pa.accountId,
      target_id: pa.accountId,
    });
    expect(rows).toContainEqual({
      action: AUDIT_ACTION.ADMIN_FACTOR_REENROLLED,
      actor_id: pa.accountId,
      target_id: pa.accountId,
    });
  });
});

import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { connectAs } from './support/database';
import {
  LEGAL_ACCEPTANCE,
  PASSWORD,
  REGISTERED_NAME,
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * The acceptance of the terms and the privacy notice over real HTTP and the real table (task 195; FR-205 behaviour 8,
 * AC-9, AC-15, AC-16; §12.5.6's task-195 row).
 *
 * The claims only a database and the whole guard chain can hold: **registration writes the rows in the account's own
 * transaction**, so a refused registration leaves neither; **the gate reads the latest row per document**, so an account
 * with none, or with a version a release has moved, is refused everything but S-43's routes while sign-out stays open;
 * and **an acceptance adds rows and never rewrites them**. That the gate covers every route is `route-matrix.e2e-spec.ts`'s.
 */
const EMAIL = 'ana@acceptance.test';
const STALE_EMAIL = 'stale@acceptance.test';
const PATH = '/api/v1/account/legal-acceptance';

interface Row {
  document: string;
  version: string;
}

describe('the acceptance of the terms and the privacy notice (task 195)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let ana: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const typeOf = (res: { body: unknown }) => (res.body as { type: string }).type;
  const rowsOf = (accountId: string) =>
    owner.query<Row[]>(
      `SELECT document, version FROM identity.legal_acceptance WHERE account_id = $1 ORDER BY accepted_at, document`,
      [accountId],
    );
  const owedOf = (res: { body: unknown }) =>
    (res.body as { object: { owed: { document: string; version: string; acceptedVersion: string | null }[] } }).object
      .owed;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-acceptance-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-acceptance-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[EMAIL, STALE_EMAIL]]);
    ana = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAIL });
  }, 120_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [[EMAIL, STALE_EMAIL]]);
    await owner?.query(`DELETE FROM identity.auth_attempt`);
    await owner?.destroy();
    await worker?.destroy();
    await app?.close();
  });

  it('records the versions a registration accepted, with the account', async () => {
    await expect(rowsOf(ana.accountId)).resolves.toEqual([
      { document: 'privacy', version: LEGAL_VERSIONS_IN_FORCE.privacy },
      { document: 'terms', version: LEGAL_VERSIONS_IN_FORCE.terms },
    ]);
    expect(owedOf(await http().get(PATH).set(ana.authorization).expect(200))).toEqual([]);
  });

  it('refuses a registration presenting a version no longer in force, creating nothing', async () => {
    const refused = await http()
      .post('/api/v1/auth/register')
      .send({
        email: STALE_EMAIL,
        password: PASSWORD,
        ...REGISTERED_NAME,
        legalVersions: { ...LEGAL_VERSIONS_IN_FORCE, terms: '0.9' },
      })
      .expect(409);
    expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/legal-version-changed`);

    const held = await owner.query<unknown[]>(`SELECT 1 FROM identity.account WHERE email = $1`, [STALE_EMAIL]);
    expect(held).toHaveLength(0);
  });

  it('refuses a registration presenting no acceptance at all', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ email: STALE_EMAIL, password: PASSWORD, ...REGISTERED_NAME })
      .expect(400);
  });

  describe('an account owing an acceptance', () => {
    beforeAll(async () => {
      // An account created before task 195: no row at all.
      await owner.query(`DELETE FROM identity.legal_acceptance WHERE account_id = $1`, [ana.accountId]);
    });

    it('is refused an ordinary route, by its own refusal', async () => {
      const refused = await http().get('/api/v1/memberships').set(ana.authorization).expect(403);
      expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/legal-acceptance-required`);
    });

    it('reads what it owes: both documents, at the versions in force, accepted never', async () => {
      expect(owedOf(await http().get(PATH).set(ana.authorization).expect(200))).toEqual([
        { document: 'terms', version: LEGAL_VERSIONS_IN_FORCE.terms, acceptedVersion: null },
        { document: 'privacy', version: LEGAL_VERSIONS_IN_FORCE.privacy, acceptedVersion: null },
      ]);
    });

    it('is refused an acceptance of a version no longer in force, and nothing is recorded', async () => {
      const refused = await http()
        .post(PATH)
        .set(ana.authorization)
        .send({ legalVersions: { ...LEGAL_VERSIONS_IN_FORCE, privacy: '0.9' } })
        .expect(409);
      expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/legal-version-changed`);
      await expect(rowsOf(ana.accountId)).resolves.toEqual([]);
    });

    it('reaches what it reached before once it accepts the versions in force', async () => {
      await http().post(PATH).set(ana.authorization).send(LEGAL_ACCEPTANCE).expect(204);

      await expect(rowsOf(ana.accountId)).resolves.toHaveLength(2);
      await http().get('/api/v1/memberships').set(ana.authorization).expect(200);
    });

    // A release moved the terms: the latest row is what the account stands on, and the earlier one stays on record.
    it('owes again the one document a release moved, and its acceptance adds a row rather than rewriting one', async () => {
      // Back-dated as the owner, so the moved row sits between the first acceptance and the next without waiting on a
      // clock: the application stamps an acceptance with its own, which runs ahead of the database's (`databaseNow`).
      await owner.query(
        `UPDATE identity.legal_acceptance SET accepted_at = accepted_at - interval '1 hour' WHERE account_id = $1`,
        [ana.accountId],
      );
      await owner.query(
        `INSERT INTO identity.legal_acceptance (account_id, document, version, accepted_at)
         VALUES ($1, 'terms', '0.9', now() - interval '30 minutes')`,
        [ana.accountId],
      );
      const refused = await http().get('/api/v1/memberships').set(ana.authorization).expect(403);
      expect(typeOf(refused)).toBe(`${PROBLEM_BASE_URI}/legal-acceptance-required`);
      expect(owedOf(await http().get(PATH).set(ana.authorization).expect(200))).toEqual([
        { document: 'terms', version: LEGAL_VERSIONS_IN_FORCE.terms, acceptedVersion: '0.9' },
      ]);

      await http().post(PATH).set(ana.authorization).send(LEGAL_ACCEPTANCE).expect(204);

      const rows = await rowsOf(ana.accountId);
      expect(rows).toHaveLength(4);
      expect(rows.filter((row) => row.document === 'privacy')).toHaveLength(1);
      await http().get('/api/v1/memberships').set(ana.authorization).expect(200);
    });

    it('may still sign out — declining leaves that and nothing else', async () => {
      await owner.query(`DELETE FROM identity.legal_acceptance WHERE account_id = $1`, [ana.accountId]);
      await http().delete('/api/v1/auth/session').send({ refreshToken: ana.refreshToken }).expect(204);
    });
  });
});

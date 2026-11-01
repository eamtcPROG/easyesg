import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { asOrganization, connectAs } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import { cleanupSignedInOperators, signInOperator, type SignedInOperator } from './support/signed-in-operator';

/**
 * A-02's record's people, and one member's phone at a time (task 167; §12.5.6's task-167 row; FR-9, FR-81) — through
 * `AdminRealmGuard`, read through `esg_admin_ro`, each disclosure a row in the system audit log that A-08 reads.
 *
 * What only this suite can prove: that the list carries **whether** a phone was given and never the number, against
 * real rows; that a disclosure is written to the log as the operator, naming the person, and that A-08's log names
 * the person by their address; and that a refused disclosure writes nothing.
 */
const RUN = `${process.pid}-${Date.now()}`;
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'http://localhost:3200';
const PHONE = '+37369123456';
const DISCLOSED = 'admin.member_phone.disclosed';

describe('an organization’s people on A-02, and a phone disclosed one at a time (task 167)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let analyst: DataSource;

  let organizationId: string;
  let withPhone: SignedInAccount;
  let withoutPhone: SignedInAccount;
  let outsider: SignedInAccount;
  let platform: SignedInOperator;
  let billing: SignedInOperator;

  const http = () => request(app.getHttpServer());
  const members = (operator: SignedInOperator, organization = organizationId) =>
    http().get(`/api/v1/admin/organizations/${organization}/members`).set(operator.cookie);
  const disclose = (operator: SignedInOperator, accountId: string) =>
    http()
      .post(`/api/v1/admin/organizations/${organizationId}/members/${accountId}/phone-disclosure`)
      .set(operator.cookie)
      .set('origin', ADMIN_ORIGIN);
  const disclosuresOf = (accountId: string) =>
    analyst.query<{ action: string; actor_id: string }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1 AND action = $2`,
      [accountId, DISCLOSED],
    );

  const grant = (account: SignedInAccount, role: string) =>
    asOrganization(owner, organizationId, (run) =>
      run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`, [
        account.accountId,
        organizationId,
        role,
      ]),
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-members-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-members-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-members-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-members-analyst');

    organizationId = randomUUID();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [
        organizationId,
        `Persoane ${RUN}`,
      ]),
    );

    const server = app.getHttpServer();
    withPhone = await signInFreshAccount({ server, worker, email: `members-phone-${RUN}@members.test` });
    withoutPhone = await signInFreshAccount({ server, worker, email: `members-nophone-${RUN}@members.test` });
    outsider = await signInFreshAccount({ server, worker, email: `members-outsider-${RUN}@members.test` });
    await grant(withPhone, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR);
    await grant(withoutPhone, MEMBERSHIP_ROLE.EDITOR);
    // The profile's phone, as S-27 stores it (task 52.3): `+` and the digits.
    await owner.query(`UPDATE identity.account SET phone = $2 WHERE id = $1`, [withPhone.accountId, PHONE]);
    await owner.query(`UPDATE identity.account SET phone = $2 WHERE id = $1`, [outsider.accountId, PHONE]);

    platform = await signInOperator({
      server,
      application,
      email: `members-pa-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    billing = await signInOperator({
      server,
      application,
      email: `members-bo-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    if (organizationId) {
      await asOrganization(owner, organizationId, (run) =>
        run(`DELETE FROM core.organization WHERE id = $1`, [organizationId]),
      );
    }
    await app?.close();
    for (const source of [owner, worker, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('lists the organization’s active members with whether each gave a phone, and never the number', async () => {
    const response = await members(platform).expect(200);
    const rows = (response.body as { objects: Record<string, unknown>[] }).objects;

    expect(rows).toHaveLength(2);
    // The whole row, by key: a phone reaching this route would arrive as exactly such a field.
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['accountId', 'displayName', 'email', 'hasPhone', 'role']);
    }
    expect(rows.find((row) => row.accountId === withPhone.accountId)).toMatchObject({
      email: withPhone.email,
      role: 'organization_administrator',
      hasPhone: true,
    });
    expect(rows.find((row) => row.accountId === withoutPhone.accountId)).toMatchObject({
      role: 'editor',
      hasPhone: false,
    });
    expect(JSON.stringify(response.body)).not.toContain(PHONE);
  });

  it('discloses one member’s phone, and records it as the operator’s act, naming the person', async () => {
    const response = await disclose(platform, withPhone.accountId).expect(200);
    expect((response.body as { object: { phone: string } }).object).toEqual({ phone: PHONE });

    expect(await disclosuresOf(withPhone.accountId)).toEqual([{ action: DISCLOSED, actor_id: platform.accountId }]);

    // A-08's log names the person by their address — the reader's join over `identity.account`.
    const log = await http()
      .get(`/api/v1/admin/audit-log?operator=${platform.accountId}`)
      .set(platform.cookie)
      .expect(200);
    const entries = (log.body as { objects: { action: string; targetEmail: string | null }[] }).objects;
    expect(entries.filter((entry) => entry.action === DISCLOSED)).toEqual([
      expect.objectContaining({ action: DISCLOSED, targetEmail: withPhone.email }),
    ]);
  });

  it('refuses a member who gave no phone, and an account that is no member, and records nothing', async () => {
    for (const account of [withoutPhone, outsider]) {
      const response = await disclose(platform, account.accountId).expect(404);
      expect((response.body as { type: string }).type).toBe(problemTypeUri(ProblemType.NotFound));
      expect(await disclosuresOf(account.accountId)).toEqual([]);
    }
  });

  it('refuses a Billing Operator both the list and a disclosure', async () => {
    const listed = await members(billing).expect(403);
    expect((listed.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InsufficientRole));
    await disclose(billing, withPhone.accountId).expect(403);
  });

  it('answers an organization the register does not hold as not found', async () => {
    await members(platform, randomUUID()).expect(404);
  });
});

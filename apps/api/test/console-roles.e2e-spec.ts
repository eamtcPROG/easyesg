import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { CONSOLE_ROLE, permissionsOf } from '../src/modules/platform/admin/models/console-role.model';
import { connectAs } from './support/database';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * The console's roles and permissions over real HTTP (task 67.13; FR-80 behaviour 10, AC-8 … AC-11; §12.5.6's task-67.13
 * row). What only this suite can prove: that a role taken away on A-08 stops the account's **next** request — the
 * roles are read per request, never sealed into the cookie — that the session answers what the console's navigation
 * reads, that each change is one system audit row, and that an invitation's roles reach the account its acceptance
 * creates. The route matrix (`admin-route-matrix.e2e-spec.ts`) holds every route to its permission.
 */
const RUN = `${process.pid}-${Date.now()}`;
const CHANGED = 'admin.account.console_roles_changed';

describe('console roles, assigned on A-08 and judged on every request (task 67.13)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let analyst: DataSource;

  let administrator: SignedInOperator;
  let colleague: SignedInOperator;
  let billing: SignedInOperator;

  const http = () => request(app.getHttpServer());
  const session = (operator: SignedInOperator) => http().get('/api/v1/auth/admin/session').set(operator.cookie);
  const change = (operator: SignedInOperator, accountId: string, roles: string[]) =>
    http()
      .put(`/api/v1/admin/accounts/${accountId}/console-roles`)
      .set(operator.cookie)
      .set('origin', ADMIN_ORIGIN)
      .send({ roles });
  const changesOf = (accountId: string) =>
    analyst.query<{ actor_id: string }[]>(
      `SELECT actor_id FROM audit.system_audit_log WHERE target_id = $1 AND action = $2`,
      [accountId, CHANGED],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-console-roles-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-console-roles-app');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-console-roles-analyst');

    const server = app.getHttpServer();
    administrator = await signInOperator({
      server,
      application,
      email: `roles-admin-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    colleague = await signInOperator({
      server,
      application,
      email: `roles-colleague-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    billing = await signInOperator({
      server,
      application,
      email: `roles-billing-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.BILLING_OPERATOR,
    });
  }, 180_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM identity.admin_invitation WHERE email LIKE $1`, [`roles-invited-%-${RUN}@easyesg.md`]);
    // Each invitation's mail is an outbox row no worker drains in an api run, and nothing cascades to it (AD-6).
    await owner?.query(
      `DELETE FROM audit.outbox_event WHERE event_type = 'platform.admin_invitation.issued' AND payload->>'email' LIKE $1`,
      [`roles-invited-%-${RUN}@easyesg.md`],
    );
    await cleanupSignedInOperators({ owner });
    await app?.close();
    for (const source of [owner, application, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('answers the roles and permissions the session holds, and none for a Billing Operator', async () => {
    const answered = (await session(administrator).expect(200)).body as {
      object: { consoleRoles: string[]; permissions: string[] };
    };
    expect(answered.object.consoleRoles).toEqual(Object.values(CONSOLE_ROLE));
    expect(answered.object.permissions).toEqual(permissionsOf(Object.values(CONSOLE_ROLE)));

    const ofBilling = (await session(billing).expect(200)).body as { object: { consoleRoles: string[] } };
    expect(ofBilling.object.consoleRoles).toEqual([]);
  });

  it('narrows a colleague to content alone, which stops their next request to an operations or support route', async () => {
    await http().get('/api/v1/admin/organizations').set(colleague.cookie).expect(200);

    await change(administrator, colleague.accountId, [CONSOLE_ROLE.CONTENT_AUTHOR]).expect(204);

    const refused = await http().get('/api/v1/admin/organizations').set(colleague.cookie).expect(403);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InsufficientRole));
    await http().get('/api/v1/admin/identity-providers').set(colleague.cookie).expect(403);
    // Their own credentials stay theirs: every operator reaches them, whatever they hold.
    await http().get('/api/v1/admin/credentials').set(colleague.cookie).expect(200);

    const narrowed = (await session(colleague).expect(200)).body as { object: { permissions: string[] } };
    expect(narrowed.object.permissions).toEqual(permissionsOf([CONSOLE_ROLE.CONTENT_AUTHOR]));
    expect(await changesOf(colleague.accountId)).toEqual([{ actor_id: administrator.accountId }]);
  });

  it('refuses a change by an operator who lacks the permission to assign, and records nothing', async () => {
    const refused = await change(colleague, administrator.accountId, [CONSOLE_ROLE.SUPPORT]).expect(403);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.InsufficientRole));
    expect(await changesOf(administrator.accountId)).toEqual([]);
  });

  it('refuses one’s own account, a Billing Operator’s, no role, and a role it does not know', async () => {
    const own = await change(administrator, administrator.accountId, [CONSOLE_ROLE.SUPPORT]).expect(409);
    expect((own.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));
    await change(administrator, billing.accountId, [CONSOLE_ROLE.SUPPORT]).expect(409);
    await change(administrator, colleague.accountId, []).expect(400);
    await change(administrator, colleague.accountId, ['superuser']).expect(400);
    expect(await changesOf(billing.accountId)).toEqual([]);
  });

  it('shows each account’s roles on A-08’s roster', async () => {
    const roster = (await http().get('/api/v1/admin/accounts').set(administrator.cookie).expect(200)).body as {
      objects: { id: string; consoleRoles: string[] }[];
    };
    expect(roster.objects.find((row) => row.id === colleague.accountId)?.consoleRoles).toEqual([
      CONSOLE_ROLE.CONTENT_AUTHOR,
    ]);
    expect(roster.objects.find((row) => row.id === billing.accountId)?.consoleRoles).toEqual([]);
  });

  it('asks an invitation for the roles its account starts with: one or more for a Platform Administrator', async () => {
    const invite = (email: string, role: string, consoleRoles: string[]) =>
      http()
        .post('/api/v1/admin/invitations')
        .set(administrator.cookie)
        .set('origin', ADMIN_ORIGIN)
        .send({ email, role, consoleRoles });

    await invite(`roles-invited-none-${RUN}@easyesg.md`, ADMIN_ROLE.PLATFORM_ADMINISTRATOR, []).expect(400);
    await invite(`roles-invited-bo-${RUN}@easyesg.md`, ADMIN_ROLE.BILLING_OPERATOR, [CONSOLE_ROLE.SUPPORT]).expect(400);
    await invite(`roles-invited-pa-${RUN}@easyesg.md`, ADMIN_ROLE.PLATFORM_ADMINISTRATOR, [
      CONSOLE_ROLE.SUPPORT,
      CONSOLE_ROLE.ACCOUNT_ADMINISTRATION,
    ]).expect(201);

    const [stored] = await owner.query<{ console_roles: string[] }[]>(
      `SELECT console_roles FROM identity.admin_invitation WHERE email = $1`,
      [`roles-invited-pa-${RUN}@easyesg.md`],
    );
    expect(stored.console_roles).toEqual([CONSOLE_ROLE.ACCOUNT_ADMINISTRATION, CONSOLE_ROLE.SUPPORT]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { AUDIT_ACTION } from '../src/modules/platform/audit/models/audit-action.model';
import {
  LEGAL_CONTROLLER_CONFIG_KIND,
  LEGAL_CONTROLLER_CONFIG_SCOPE,
} from '../src/modules/platform/legal/constants/legal-controller.constants';
import { connectAs } from './support/database';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';
import { restoreSlot, snapshotSlot, type SlotSnapshot } from './support/configuration-slot';

/**
 * A-21 and the public read over real HTTP (task 75; FR-205; §12.5.6's task-75 row (7), (8)) — the operator's reading, a
 * save attributed to the operator, logged, and served to the legal documents' read with no redeploy, a stale save
 * refused, and the refusals an operator can act on.
 *
 * **What it needs and does not create**: a readable controller in force, which `pretest:e2e`'s `config:seed` publishes
 * from `config/seed/legal-controller.global.json`. The answer with none readable is a unit spec's
 * (`legal-controller.service.spec.ts`): the store refuses to publish a malformed controller, which is the point, and has
 * no way to un-publish a slot.
 */
const RUN = `${process.pid}-${Date.now()}`;
const address = (label: string) => `legal-controller-${label}-${RUN}@easyesg.md`;

interface ControllerRecord {
  registeredName: string;
  idno: string;
  registeredAddress: string;
  dataProtectionEmail: string;
  revision: number;
  changedByEmail: string | null;
  changedAt: number | null;
}

const VALID = {
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
};

describe('the platform operator from the console and on the legal documents (A-21; task 75)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let adminReader: DataSource;
  let platform: SignedInOperator;
  let slot: SlotSnapshot | undefined;

  const http = () => request(app.getHttpServer());
  const asPlatform = (call: request.Test) => call.set(platform.cookie).set('origin', ADMIN_ORIGIN);

  const record = async (): Promise<ControllerRecord> =>
    ((await asPlatform(http().get('/api/v1/admin/legal-controller')).expect(200)).body as { object: ControllerRecord })
      .object;

  const publish = (body: Record<string, unknown>) =>
    asPlatform(http().post('/api/v1/admin/legal-controller/publication')).send(body);

  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    slot = await snapshotSlot(app, { kind: LEGAL_CONTROLLER_CONFIG_KIND, scope: LEGAL_CONTROLLER_CONFIG_SCOPE });

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-legal-controller-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-legal-controller-app');
    adminReader = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-legal-controller-ro');

    platform = await signInOperator({
      server: app.getHttpServer(),
      application,
      email: address('pa'),
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
  }, 60_000);

  afterAll(async () => {
    // What the store held before this suite, under its own publisher (task 172) — the seed only where nothing was.
    const seed = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/legal-controller.global.json'), 'utf8'),
    ) as Record<string, unknown>;
    if (app !== undefined && slot !== undefined) await restoreSlot(app, slot, seed);

    if (owner !== undefined) await cleanupSignedInOperators({ owner });
    await app?.close();
    await owner?.destroy();
    await application?.destroy();
    await adminReader?.destroy();
  });

  it('serves the operator in force to a reader with no session', async () => {
    const response = await http().get('/api/v1/legal/controller').expect(200);
    const served = (response.body as { object: Record<string, string> }).object;

    const { registeredName, idno, registeredAddress, dataProtectionEmail } = await record();
    expect(served).toEqual({ registeredName, idno, registeredAddress, dataProtectionEmail });
  });

  it('publishes a save attributed to the operator, logs it, and the documents’ read names it with no redeploy', async () => {
    const before = await record();
    const registeredName = `Operator ${RUN} SRL`;

    const saved = await publish({ ...VALID, registeredName: `  ${registeredName} `, revision: before.revision }).expect(
      201,
    );
    const publication = (saved.body as { object: { id: string; revision: number } }).object;

    expect(publication.revision).toBe(before.revision + 1);
    expect(await record()).toMatchObject({
      registeredName,
      revision: before.revision + 1,
      changedByEmail: platform.email,
    });

    const served = await http().get('/api/v1/legal/controller').expect(200);
    expect((served.body as { object: { registeredName: string } }).object.registeredName).toBe(registeredName);

    const rows = await adminReader.query<{ action: string; actor_id: string }[]>(
      `SELECT action, actor_id FROM audit.system_audit_log WHERE target_id = $1`,
      [publication.id],
    );
    expect(rows).toEqual([{ action: AUDIT_ACTION.ADMIN_LEGAL_CONTROLLER_PUBLISHED, actor_id: platform.accountId }]);
  });

  it('refuses a save made against a revision no longer in force, and publishes nothing', async () => {
    const current = await record();

    const refused = await publish({ ...VALID, registeredName: `Stale ${RUN} SRL`, revision: current.revision - 1 }).expect(
      409,
    );

    // The wire literal, on purpose: A-21's conflict state branches on `@easyesg/contracts`' copy of this URI.
    expect(problemType(refused)).toBe('https://easyesg.md/problems/legal-controller-changed');
    expect((await record()).revision).toBe(current.revision);
  });

  it('refuses an IDNO whose check digit is wrong, naming the fault, and a save identical to what is in force', async () => {
    const current = await record();

    const invalid = await publish({
      ...VALID,
      registeredName: current.registeredName,
      idno: '1099600012346',
      revision: current.revision,
    }).expect(400);
    expect(problemType(invalid)).toBe(problemTypeUri(ProblemType.ValidationFailed));
    const refusal = invalid.body as { fault?: string; detail?: string };
    expect(refusal.fault).toBe('idno_check_digit');
    expect(refusal.detail).toEqual(expect.any(String));

    const unchanged = await publish({
      registeredName: current.registeredName,
      idno: current.idno,
      registeredAddress: current.registeredAddress,
      dataProtectionEmail: current.dataProtectionEmail,
      revision: current.revision,
    }).expect(409);
    expect(problemType(unchanged)).toBe(problemTypeUri(ProblemType.Conflict));
    expect((await record()).revision).toBe(current.revision);
  });
});

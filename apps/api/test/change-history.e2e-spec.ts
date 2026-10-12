import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteHintsOf } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-000000000084';
const EMAILS = {
  admin: 'oa@change-history.test',
  editor: 'rc@change-history.test',
  leaver: 'leaver@change-history.test',
  viewer: 'viewer@change-history.test',
};
const CHISINAU = 'Europe/Chisinau';
const PROBLEM_BASE = 'https://easyesg.md/problems/';
/** Romanian, the source locale, so the words asserted are the ones the screens show. */
const RO = { 'Accept-Language': 'ro' };

interface Entry {
  at: number;
  actor: { accountId: string; name: string | null; removed: boolean } | null;
  source: string | null;
  changes: { field: string | null; from: string | null; to: string | null }[];
}

/**
 * UC-47 end to end (task 84.1; FR-54, FR-55; `architecture.md` §12.5.6's task-84 row): the three histories over real
 * HTTP — the organization's, an entity's and one disclosure field's — each newest first and worded in the reader's
 * language, with the person who made each change, a member since removed marked so, and an account since erased still
 * stating the field and the moment (FR-54 AC-4). The step read counts the same entries the field's history lists.
 */
describe('change history (task 84)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let leaver: SignedInAccount;
  let viewer: SignedInAccount;
  let leaverMembership: string;
  let entityId: string;
  let reportId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const entriesOf = (body: unknown): Entry[] => (body as { objects: Entry[] }).objects;
  const totalOf = (body: unknown): number => (body as { total: number }).total;
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;
  const valueHistory = (elementKey: string) => `/api/v1/reports/${reportId}/values/${elementKey}/history`;

  const removeFixtures = async (): Promise<void> => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-change-history-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-change-history-worker');
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Lina', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    leaver = await signInFreshAccount({ server, worker, email: EMAILS.leaver });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    await owner.query(`UPDATE identity.account SET given_name = 'Dorin', family_name = 'Mardari' WHERE id = $1`, [
      leaver.accountId,
    ]);
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
      [leaver, MEMBERSHIP_ROLE.EDITOR],
      [viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      const [row] = (await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3) RETURNING id`, [
          account.accountId,
          ORG,
          role,
        ]))) as { id: string }[];
      if (account === leaver && row !== undefined) leaverMembership = row.id;
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Brutăria Lina', legalForm: 'srl', naceCodes: ['10.71'], idno: '1003600005148',
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    entityId = objectOf<{ id: string }>(entity.body).id;
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    reportId = objectOf<{ id: string }>(report.body).id;
  }, 120_000);

  afterAll(async () => {
    await deleteHintsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('states a field’s answers newest first, with who, the source and a removed member marked (AC-5; FR-55)', async () => {
    const write = (account: SignedInAccount, values: Record<string, unknown>[]) =>
      http().put(`/api/v1/reports/${reportId}/values`).set(account.authorization).send({ values }).expect(200);
    await write(leaver, [{ elementKey: 'NumberOfEmployees', valueNumeric: '44', state: DISCLOSURE_STATE.OK }]);
    await write(editor, [{ elementKey: 'NumberOfEmployees', valueNumeric: '47', state: DISCLOSURE_STATE.OK }]);
    await write(editor, [{ elementKey: 'NumberOfEmployees', state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: 'Registrul se reface.' }]);
    // The leaver loses access; their change stays attributed (FR-55, UX-69).
    await http().delete(`/api/v1/members/${leaverMembership}`).set(admin.authorization).expect(204);

    const read = await http().get(valueHistory('NumberOfEmployees')).set(editor.authorization).set(RO).expect(200);
    const entries = entriesOf(read.body);
    expect(totalOf(read.body)).toBe(3);
    expect(entries.map((entry) => entry.changes[0])).toEqual([
      { field: null, from: '47', to: 'Indisponibil' },
      { field: null, from: '44', to: '47' },
      { field: null, from: null, to: '44' },
    ]);
    // The declaration's reason is its own field, named — the answer is the panel's subject and carries no name.
    expect(entries[0]?.changes[1]).toEqual({
      field: 'Motivul pentru care valoarea nu este disponibilă',
      from: null,
      to: 'Registrul se reface.',
    });
    expect(entries.map((entry) => entry.source)).toEqual(['typed', 'typed', 'typed']);
    expect(entries[2]?.actor).toEqual({ accountId: leaver.accountId, name: 'Dorin Mardari', removed: true });
    expect(entries[1]?.actor).toMatchObject({ accountId: editor.accountId, removed: false });
    expect(entries[0]?.at).toBeGreaterThanOrEqual(entries[1]?.at ?? Number.POSITIVE_INFINITY);

    // The step read's footer counts the same entries (row (b)).
    const step = await http().get(`/api/v1/reports/${reportId}/modules/B1`).set(viewer.authorization).expect(200);
    const fields = objectOf<{ fields: { elementKey: string; dimensionKey: string; changeCount: number }[] }>(step.body).fields;
    expect(fields.find((field) => field.elementKey === 'NumberOfEmployees' && field.dimensionKey === '')?.changeCount).toBe(3);
    expect(fields.find((field) => field.elementKey === 'Turnover')?.changeCount).toBe(0);

    // A page is a slice of the same list.
    const second = await http().get(valueHistory('NumberOfEmployees')).query({ page: 2, onpage: 2 })
      .set(editor.authorization).set(RO).expect(200);
    expect(entriesOf(second.body).map((entry) => entry.changes[0]?.to)).toEqual(['44']);
    expect(totalOf(second.body)).toBe(3);
  });

  it('still states the field and the moment once the account that made a change is erased (FR-54 AC-4)', async () => {
    await owner.query(`DELETE FROM identity.account WHERE id = $1`, [leaver.accountId]);
    const read = await http().get(valueHistory('NumberOfEmployees')).set(editor.authorization).set(RO).expect(200);
    const oldest = entriesOf(read.body).at(-1);
    expect(oldest?.actor).toEqual({ accountId: leaver.accountId, name: null, removed: true });
    expect(oldest?.changes[0]).toEqual({ field: null, from: null, to: '44' });
    expect(typeof oldest?.at).toBe('number');
  });

  it('answers a field never answered with no entries, and an unknown report with 404', async () => {
    const empty = await http().get(valueHistory('Turnover')).set(editor.authorization).expect(200);
    expect(entriesOf(empty.body)).toEqual([]);
    expect(totalOf(empty.body)).toBe(0);
    const unknown = await http().get(`/api/v1/reports/01930000-0000-7000-8000-0000000000ff/values/Turnover/history`)
      .set(editor.authorization).expect(404);
    expect(problemType(unknown)).toBe(`${PROBLEM_BASE}not-found`);
  });

  it('words an entity’s legal form and activities, and refuses a view-only member (182/22)', async () => {
    await http().patch(`/api/v1/entities/${entityId}`).set(admin.authorization)
      .send({ legalForm: 'sa', naceCodes: ['10.71', '11.02'] }).expect(200);

    const read = await http().get(`/api/v1/entities/${entityId}/history`).set(editor.authorization).set(RO).expect(200);
    const [latest, creation] = entriesOf(read.body);
    expect(latest?.source).toBeNull();
    expect(latest?.actor).toMatchObject({ accountId: admin.accountId, removed: false });
    expect(latest?.changes.map((change) => change.field)).toEqual(['Forma juridică', 'Activitățile entității (CAEM)']);
    expect(latest?.changes[0]).toMatchObject({
      from: 'Societate cu răspundere limitată (SRL)',
      to: 'Societate pe acțiuni (SA)',
    });
    expect(latest?.changes[1]?.from).toMatch(/^10\.71 · \S/);
    expect(latest?.changes[1]?.to).toMatch(/^10\.71 · \S.*11\.02 · \S/);
    // The creation states what was written, and nothing of the columns no field shows — ids, timestamps, the tenant.
    expect(creation?.changes.map((change) => change.field)).toEqual([
      'Denumirea entității', 'Forma juridică', 'Activitățile entității (CAEM)', 'IDNO', 'Starea entității',
    ]);
    expect(creation?.changes.find((change) => change.field === 'Starea entității')?.to).toBe('Activă');

    const refused = await http().get(`/api/v1/entities/${entityId}/history`).set(viewer.authorization).expect(403);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}insufficient-role`);
    await http().get('/api/v1/entities/01930000-0000-7000-8000-0000000000ff/history').set(editor.authorization).expect(404);
  });

  it('states the organization’s settings to its administrator alone, as its profile is', async () => {
    await http().patch('/api/v1/organization').set(admin.authorization).send({ name: 'Brutăria Lina SRL' }).expect(200);

    const read = await http().get('/api/v1/organization/history').set(admin.authorization).set(RO).expect(200);
    expect(entriesOf(read.body)[0]?.changes).toEqual([
      { field: 'Numele organizației', from: 'Brutăria Lina', to: 'Brutăria Lina SRL' },
    ]);
    for (const account of [editor, viewer]) {
      const refused = await http().get('/api/v1/organization/history').set(account.authorization).expect(403);
      expect(problemType(refused)).toBe(`${PROBLEM_BASE}insufficient-role`);
    }
  });
});

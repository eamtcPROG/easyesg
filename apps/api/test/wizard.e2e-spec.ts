import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../src/modules/core/disclosure/constants/disclosure.constants';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { TAXONOMY_STANDARD } from '../src/modules/platform/taxonomy/constants/taxonomy.constants';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000f3';
const EMAILS = { admin: 'oa@wizard.test', editor: 'rc@wizard.test', viewer: 'vi@wizard.test' };
const CHISINAU = 'Europe/Chisinau';

/** Real, undimensioned, and in B1 at both registered versions. */
const B1_ELEMENT = 'BasisForPreparation';

/**
 * The wizard's server half over real HTTP (task 89; S-07, UC-19, UC-35; FR-24 … FR-32, FR-37).
 *
 * **What it is really testing is the pin.** Every read here resolves against the report's OWN
 * taxonomy version, and task 33.3 registered a second one so that is a fact this suite can check
 * rather than a sentence a docblock asserts: a FY2025 report and a FY2026 report pin different
 * versions through the product's own path, and both must render.
 */
describe('the wizard surface (S-07; UC-19, UC-35)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const objectsOf = <T>(body: unknown): T[] => (body as { objects: T[] }).objects;

  interface Cause {
    condition: string;
    drivers: { elementKey: string; label: string | null }[];
    threshold: string | null;
    answer: string | null;
  }
  interface ModuleSummary {
    module: string; answered: number; total: number; lastAnsweredAt: number | null;
    applicable: boolean; applicabilityCause: Cause | null;
  }
  interface Field {
    elementKey: string; ordinal: number; kind: string; periodType: string; order: number;
    label: string | null; labelStanding: string | null; repeating: boolean; axes: string[];
    valueText: string | null; valueNumeric: string | null; state: string; carriedForward: boolean;
    help: string | null;
    options: { value: string; label: string | null; code: string | null }[] | null;
    defaultValue: { valueText: string | null; valueNumeric: string | null } | null;
    applicable: boolean;
    applicabilityCause: Cause | null;
  }
  interface Step { module: string; taxonomyVersion: string; fields: Field[] }

  const openPeriod = async (year: number): Promise<string> => {
    const response = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: year,
      periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
    }).expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  const createReport = async (periodId: string): Promise<string> => {
    const response = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: periodId }).expect(201);
    return (response.body as { object: { id: string } }).object.id;
  };

  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-wizard-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-wizard-worker');

    // Before inserting, not only after — task 88's rule.
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Vadul SRL', 'MD')`, [ORG]));

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
      [viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
          [account.accountId, ORG, role]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Vadul lui Vodă', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Hala', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  beforeEach(async () => {
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.reporting_period WHERE organization_id = $1`, [ORG]));
  });

  it('lists the modules the pinned version carries, in the standard order', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);

    // B1 … B11 then C1 … C9 — the taxonomy's own order, not alphabetical, which would put B10 second.
    expect(modules.map((m) => m.module).slice(0, 12)).toEqual([
      'B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','C1',
    ]);
    // Every module has fields to answer except the ones FR-28 has not yet admitted (task 91.3).
    // With B1 unanswered, B6 is the only module whose every element is conditional — all four of
    // its water disclosures — so it is the one that starts at zero and says it does not apply,
    // which is UX-9's "B1 before any conditional module" as the list shows it.
    expect(modules.filter((m) => m.total === 0).map((m) => m.module)).toEqual(['B6']);
    expect(modules.find((m) => m.module === 'B6')?.applicable).toBe(false);
    expect(modules.filter((m) => m.module !== 'B6').every((m) => m.total > 0 && m.applicable)).toBe(true);
    expect(modules.every((m) => m.answered === 0)).toBe(true);
    // Nothing answered anywhere: no module can say when work last happened in it.
    expect(modules.every((m) => m.lastAnsweredAt === null)).toBe(true);
  });

  it('says where work last happened, per module, from the values themselves (FR-39, task 35.3)', async () => {
    const reportId = await createReport(await openPeriod(2026));
    const before = Date.now();

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: B1_ELEMENT, valueText: 'Individual', state: DISCLOSURE_STATE.OK }],
    }).expect(200);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    const b1 = modules.find((m) => m.module === 'B1');
    // Epoch milliseconds, from the store's own `updated_at` — derived, never written separately.
    expect(b1?.lastAnsweredAt).toBeGreaterThanOrEqual(before);
    expect(b1?.lastAnsweredAt).toBeLessThanOrEqual(Date.now());
    expect(modules.filter((m) => m.module !== 'B1').every((m) => m.lastAnsweredAt === null)).toBe(true);

    // The MOST RECENT answer in the module, not the last one in the taxonomy's order: `Assets`
    // iterates before `BasisForPreparation`, and it is answered second, so a summary that took the
    // last element it met would report the older timestamp.
    const later = objectsOf<{ updatedAt: number }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: 'Assets', valueNumeric: '1000', state: DISCLOSURE_STATE.OK }],
      }).expect(200)).body);
    const withTwo = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(withTwo.find((m) => m.module === 'B1')?.lastAnsweredAt).toBe(later[0]?.updatedAt);
    expect(later[0]?.updatedAt).toBeGreaterThanOrEqual(b1?.lastAnsweredAt ?? Number.POSITIVE_INFINITY);

    // Clearing the answer back to missing is not work in the module: the position must not move
    // to a step whose only event was an erasure.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: B1_ELEMENT, state: DISCLOSURE_STATE.MISSING }],
    }).expect(200);
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'Assets', state: DISCLOSURE_STATE.MISSING }],
    }).expect(200);
    const after = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(after.find((m) => m.module === 'B1')?.lastAnsweredAt).toBeNull();
  });

  it('serves a step with its fields, labels and standing, in presentation order', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);

    expect(step.module).toBe('B1');
    expect(step.taxonomyVersion).toBe('2026-05-01');
    expect(step.fields.length).toBeGreaterThan(0);
    // Presentation order is EFRAG's, and a step that rendered it out of order would read as a
    // different questionnaire.
    const orders = step.fields.map((f) => f.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);

    const field = step.fields.find((f) => f.elementKey === B1_ELEMENT);
    expect(field).toBeDefined();
    expect(field?.state).toBe(DISCLOSURE_STATE.MISSING);
    // The wording and whose it is travel together (NFR-24) — a label without its standing cannot
    // make UX-47's statement.
    expect(field?.label).toBeTruthy();
    expect(field?.labelStanding).toBeTruthy();
  });

  it('persists a value, acknowledges the commit, and reads it back on the step', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const written = objectsOf<{ elementKey: string; valueText: string | null; state: string }>(
      (await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B1_ELEMENT, valueText: 'Consolidated', state: DISCLOSURE_STATE.OK }],
      }).expect(200)).body);

    // UX-36: the acknowledgement is the durable commit, so the response is what was stored.
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ elementKey: B1_ELEMENT, valueText: 'Consolidated' });

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);
    const field = step.fields.find((f) => f.elementKey === B1_ELEMENT);
    expect(field?.valueText).toBe('Consolidated');
    expect(field?.state).toBe(DISCLOSURE_STATE.OK);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  it('offers each choice field its answers, worded in the request’s locale, and help where EFRAG documents it (task 91.1)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);

    // A `vsme` domain: two members, qualified as the export emits them, worded by the catalogue.
    const basis = step.fields.find((f) => f.elementKey === 'BasisForReporting');
    expect(basis?.options?.map((o) => o.value).sort()).toEqual(['vsme:ConsolidatedMember', 'vsme:IndividualMember']);
    expect(basis?.options?.every((o) => typeof o.label === 'string' && o.label.length > 0)).toBe(true);
    expect(basis?.options?.some((o) => /\[member\]/u.test(o.label ?? ''))).toBe(false);

    // NACE: the classification the package ships, coded as CAEM prints it, named by the platform's
    // own classifier in the request's locale.
    const nace = step.fields.find((f) => f.elementKey === 'NaceSectorClassificationCodes');
    expect(nace?.options?.length).toBe(1047);
    const cereals = nace?.options?.find((o) => o.value === 'nace:NACE_A0111');
    expect(cereals?.code).toBe('01.11');
    // The platform's own Romanian for 01.11 — `nace-code.md.json`'s — not EFRAG's English fallback,
    // which `toBeTruthy()` could not tell apart (gate-integrity review). The suite negotiates `ro`.
    const caem = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/nace-code.md.json'), 'utf8'),
    ) as { codes: Record<string, Record<string, string>> };
    expect(cereals?.label).toBe(caem.codes['01.11']?.ro);
    expect(cereals?.label).not.toBe(caem.codes['01.11']?.en);

    // ISO 3166 is referenced and not shipped: the countries the platform registers, unnamed here.
    const country = step.fields.find((f) => f.elementKey === 'CountryOfPrimaryOperationsAndLocationOfSignificantAssets');
    expect(country?.options?.map((o) => o.value)).toEqual(['country:MD']);
    expect(country?.options?.[0]?.label).toBeNull();

    // A field that is not a choice offers nothing, and help is present exactly where published.
    const employees = step.fields.find((f) => f.elementKey === 'NumberOfEmployees');
    expect(employees?.options).toBeNull();
    expect(employees?.help).toBeNull();
    const certifications = step.fields.find(
      (f) => f.elementKey === 'DescriptionOfSustainabilityRelatedCertificationsOrLabels',
    );
    expect(certifications?.help).toBeTruthy();
  });

  it('writes the same row on a retry, because the key is natural (FR-38)', async () => {
    const reportId = await createReport(await openPeriod(2026));
    const body = {
      values: [{ elementKey: B1_ELEMENT, valueText: 'Individual', state: DISCLOSURE_STATE.OK }],
    };

    const first = objectsOf<{ id: string }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send(body).expect(200)).body);
    const again = objectsOf<{ id: string }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send(body).expect(200)).body);

    // An offline queue that retries must not leave two answers to one question.
    expect(again[0].id).toBe(first[0].id);
  });

  it('counts a deliberate non-answer as answered (FR-30, FR-32)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{
        elementKey: B1_ELEMENT,
        state: DISCLOSURE_STATE.NOT_AVAILABLE,
        notAvailableReason: 'Not collected for this period.',
      }],
    }).expect(200);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    // A considered non-answer is an answer. Counting it as outstanding would tell a reporter they
    // still have work on a field they have already decided.
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  it('refuses a field the pinned version does not name', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'NoSuchElementInAnyVersion', state: DISCLOSURE_STATE.OK }],
    }).expect(400);
  });

  const readStep = async (reportId: string, module = 'B1'): Promise<Step> =>
    objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/${module}`).set(editor.authorization).expect(200)).body);
  const rowsOf = (step: Step, elementKey: string): Field[] =>
    step.fields.filter((f) => f.elementKey === elementKey).sort((a, b) => a.ordinal - b.ordinal);
  /** The default's text, `null` where the row carries none — and `undefined` only where the row itself is absent. */
  const defaultText = (field: Field | undefined): string | null | undefined =>
    field === undefined ? undefined : field.defaultValue === null ? null : field.defaultValue.valueText;
  const defaultOf = (step: Step, elementKey: string, ordinal = 0): string | null | undefined =>
    defaultText(rowsOf(step, elementKey)[ordinal]);

  it('opens B1 pre-filled from the period’s entity snapshot, with nothing stored (FR-27, UX-109; task 91.2)', async () => {
    const reportId = await createReport(await openPeriod(2026));
    const step = await readStep(reportId);

    // The entity: `srl`, CAEM 10.71, one site in Chișinău, MD — each in EFRAG's own terms.
    expect(defaultOf(step, 'UndertakingsLegalForm')).toBe('vsme:PrivateLimitedLiabilityUndertakingMember');
    expect(defaultOf(step, 'NaceSectorClassificationCodes')).toBe('nace:NACE_C1071');
    expect(defaultOf(step, 'CityOfSite')).toBe('Chișinău');
    expect(defaultOf(step, 'CountryOfSite')).toBe('country:MD');
    // The report: its scope is the basis for preparation.
    expect(defaultOf(step, 'BasisForPreparation')).toBe('vsme:OptionABasicModuleOnlyMember');
    // What the platform does not know opens empty — the site has no street, the boundary is unstated.
    expect(defaultOf(step, 'AddressOfSite')).toBeNull();
    expect(rowsOf(step, 'BasisForReporting')[0]?.defaultValue).toBeNull();
    expect(rowsOf(step, 'NumberOfEmployees')[0]?.defaultValue).toBeNull();

    // A default is not an answer: every field is still missing, and the module list agrees.
    expect(step.fields.every((f) => f.state === DISCLOSURE_STATE.MISSING && f.valueText === null)).toBe(true);
    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(0);
  });

  it('keeps the snapshot’s defaults after the entity changes, and a stored answer replaces the default without touching the entity (FR-18, D-2)', async () => {
    // A dedicated entity, so the shared fixture's snapshot is not what this test edits.
    const created = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Moara Veche', legalForm: 'srl', naceCodes: ['10.61'], sites: [],
    }).expect(201);
    const ownEntity = (created.body as { object: { id: string } }).object.id;
    const period = (await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: ownEntity, fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201)).body as { object: { id: string } };
    const reportId = await createReport(period.object.id);

    // The Administrator corrects the record AFTER the period opened.
    await http().patch(`/api/v1/entities/${ownEntity}`).set(admin.authorization)
      .send({ legalForm: 'cp' }).expect(200);

    // The filing keeps the values in force when it was prepared (FR-18), not the entity's now.
    expect(defaultOf(await readStep(reportId), 'UndertakingsLegalForm')).toBe('vsme:PrivateLimitedLiabilityUndertakingMember');

    // The reporter answers otherwise. The store row wins, the default is gone for that key only …
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'UndertakingsLegalForm', valueText: 'vsme:SoleProprietorshipMember', state: DISCLOSURE_STATE.OK }],
    }).expect(200);
    const answered = await readStep(reportId);
    expect(rowsOf(answered, 'UndertakingsLegalForm')[0]).toMatchObject({
      valueText: 'vsme:SoleProprietorshipMember', defaultValue: null,
    });
    expect(defaultOf(answered, 'NaceSectorClassificationCodes')).toBe('nace:NACE_C1061');

    // … and a row cleared back to missing is a decision, not an invitation to re-fill.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'UndertakingsLegalForm', state: DISCLOSURE_STATE.MISSING }],
    }).expect(200);
    expect(rowsOf(await readStep(reportId), 'UndertakingsLegalForm')[0]?.defaultValue).toBeNull();

    // D-2: the disclosure never wrote the master record — it still says what the Administrator set.
    const entity = objectOf<{ legalForm: string }>((await http()
      .get(`/api/v1/entities/${ownEntity}`).set(admin.authorization).expect(200)).body);
    expect(entity.legalForm).toBe('cp');
  });

  it('says which fields repeat, and a fixed member axis does not (task 36.2)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    const b1 = await readStep(reportId);
    const site = b1.fields.find((f) => f.elementKey === 'CityOfSite');
    // A typed axis: its rows are sites the reporter adds, so the screen may offer to add one.
    expect({ axes: site?.axes, repeating: site?.repeating }).toEqual({
      axes: ['IdentifierOfSiteTypedAxis'],
      repeating: true,
    });
    expect(b1.fields.find((f) => f.elementKey === 'NumberOfEmployees')?.repeating).toBe(false);

    // The case a client-side guess gets wrong: three B3 elements share ONE axis, and it is a fixed
    // member domain — "several elements share an axis" would offer to add a row to a classification.
    const b3 = await readStep(reportId, 'B3');
    const breakdown = b3.fields.filter((f) => f.axes.includes('BreakdownOfEnergyConsumptionAxis'));
    expect(breakdown.length).toBeGreaterThan(1);
    expect(breakdown.every((f) => !f.repeating)).toBe(true);
  });

  it('lays sites and subsidiaries out as repeating groups, one row per snapshot entry, in its order', async () => {
    const created = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Grupul Codru', legalForm: 'sa', naceCodes: ['10.71'],
      sites: [
        { name: 'Depozit', locality: 'Bălți', addressLine1: 'str. Decebal 1', countryCode: 'MD' },
        { name: 'Atelier', locality: 'Orhei', countryCode: 'MD', latitude: '47.383300', longitude: '28.823300' },
      ],
    }).expect(201);
    const ownEntity = (created.body as { object: { id: string } }).object.id;
    await http().patch(`/api/v1/entities/${ownEntity}`).set(admin.authorization).send({
      consolidationBasis: 'consolidated',
      consolidationMembers: [{ name: 'Codru Sud SRL', idno: '1002600012345', countryCode: 'MD' }],
    }).expect(200);
    const period = (await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: ownEntity, fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201)).body as { object: { id: string } };
    const reportId = await createReport(period.object.id);
    const step = await readStep(reportId);

    // The snapshot orders sites by name: Atelier, then Depozit.
    expect(rowsOf(step, 'CityOfSite').map((f) => [f.ordinal, defaultText(f)])).toEqual([
      [0, 'Orhei'], [1, 'Bălți'],
    ]);
    expect(rowsOf(step, 'AddressOfSite').map(defaultText)).toEqual([null, 'str. Decebal 1']);
    expect(rowsOf(step, 'GPSLocationOfSite').map(defaultText)).toEqual(['47.383300, 28.823300', null]);
    // `sa` has no EFRAG member of its own — the owner's table classes it as "other".
    expect(defaultOf(step, 'UndertakingsLegalForm')).toBe('vsme:OtherUndertakingsLegalFormMember');
    expect(defaultOf(step, 'BasisForReporting')).toBe('vsme:ConsolidatedMember');
    expect(rowsOf(step, 'NameOfTheSubsidiary').map(defaultText)).toEqual(['Codru Sud SRL']);
    // A field with no repeating group is still exactly one row.
    expect(rowsOf(step, 'UndertakingsLegalForm')).toHaveLength(1);

    // A third site answered by the reporter is a third row beside the two snapshotted ones.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'CityOfSite', ordinal: 2, valueText: 'Cahul', state: DISCLOSURE_STATE.OK }],
    }).expect(200);
    const grown = await readStep(reportId);
    expect(rowsOf(grown, 'CityOfSite').map((f) => [f.ordinal, f.valueText, defaultText(f)])).toEqual([
      [0, null, 'Orhei'], [1, null, 'Bălți'], [2, 'Cahul', null],
    ]);
    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  it('serves an EARLIER-pinned report from its own version (DR-4, task 33.3)', async () => {
    // A FY2025 period pins 2026-02-01 through the product's own adoption schedule.
    const reportId = await createReport(await openPeriod(2025));

    const step = objectOf<Step>((await http()
      .get(`/api/v1/reports/${reportId}/modules/B1`).set(editor.authorization).expect(200)).body);

    // The report's OWN version, not the newest registered — which is the whole of DR-4 at a read.
    expect(step.taxonomyVersion).toBe('2026-02-01');
    expect(step.fields.find((f) => f.elementKey === B1_ELEMENT)?.label).toBeTruthy();
    // And pre-filled too (task 91.2). This says the defaults reach an earlier-pinned report, not
    // that they were resolved against ITS version — `srl`'s member is declared identically in both
    // shipped versions, so no fixture here can tell the two apart; DR-4 at the default is
    // `entity-defaults.spec.ts`'s claim, where a member one version lacks is proven to serve nothing.
    expect(defaultOf(step, 'UndertakingsLegalForm')).toBe('vsme:PrivateLimitedLiabilityUndertakingMember');
  });

  it('lets a viewer read and refuses their write (FR-25, FR-26)', async () => {
    const reportId = await createReport(await openPeriod(2026));

    await http().get(`/api/v1/reports/${reportId}/modules`).set(viewer.authorization).expect(200);
    await http().put(`/api/v1/reports/${reportId}/values`).set(viewer.authorization).send({
      values: [{ elementKey: B1_ELEMENT, valueText: 'x', state: DISCLOSURE_STATE.OK }],
    }).expect(403);
  });

  it('refuses a write once the period is locked (FR-22)', async () => {
    const periodId = await openPeriod(2026);
    const reportId = await createReport(periodId);
    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: B1_ELEMENT, valueText: 'late', state: DISCLOSURE_STATE.OK }],
    }).expect(409);
  });

  /**
   * FR-28's conditional applicability over real HTTP (task 91.3; BR-APP-1 … BR-APP-5, UX-26 … UX-28).
   *
   * The unit spec holds every boundary; what only this level can show is that the rules reach the
   * two reads from the **configuration store**, against the report's own stored answers — and that
   * a value under a field that stops applying survives (UX-28).
   */
  describe('conditional applicability (FR-28)', () => {
    const HEADCOUNT = 'NumberOfEmployees';
    const TURNOVER_RATE = 'EmployeeTurnoverRate';
    const ACTIVITY_CODES = 'NaceSectorClassificationCodes';
    const WATER_CONSUMPTION = 'TotalWaterConsumption';
    const BIODIVERSITY = 'SiteLocatedInABiodiversitySensitiveArea';

    const write = async (reportId: string, values: Record<string, unknown>[]): Promise<void> => {
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
        .send({ values }).expect(200);
    };
    const headcount = (value: string) => ({ elementKey: HEADCOUNT, valueNumeric: value, state: DISCLOSURE_STATE.OK });
    const fieldOf = (step: Step, elementKey: string): Field | undefined =>
      step.fields.find((f) => f.elementKey === elementKey);
    const moduleOf = async (reportId: string, module: string): Promise<ModuleSummary | undefined> =>
      objectsOf<ModuleSummary>((await http()
        .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body)
        .find((m) => m.module === module);

    it('brings B8’s turnover rate in at 50 employees and not at 49, naming the cause (BR-APP-1)', async () => {
      const reportId = await createReport(await openPeriod(2026));

      await write(reportId, [headcount('49')]);
      const below = fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE);
      expect(below?.applicable).toBe(false);
      // UX-27's announcement names the B1 answer that caused it — the element's own wording, since
      // no reader may be shown `NumberOfEmployees`.
      expect(below?.applicabilityCause).toMatchObject({
        condition: 'numeric_at_least',
        threshold: '50',
        answer: '49',
        drivers: [{ elementKey: HEADCOUNT }],
      });
      // The driver's OWN wording, not merely some label: a cause that named the right element and
      // rendered another's would announce the wrong reason, and `not.toBeNull()` could not see it.
      const b1Headcount = (await readStep(reportId)).fields.find((f) => f.elementKey === HEADCOUNT);
      expect(b1Headcount?.label).not.toBeNull();
      expect(below?.applicabilityCause?.drivers[0]?.label).toBe(b1Headcount?.label);

      await write(reportId, [headcount('50')]);
      const at = fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE);
      expect(at?.applicable).toBe(true);
      expect(at?.applicabilityCause?.answer).toBe('50');
    });

    it('holds B10’s pay gap to 150, the same read answering both thresholds (BR-APP-2)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await write(reportId, [headcount('149')]);

      expect(fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE)?.applicable).toBe(true);
      const gap = fieldOf(await readStep(reportId, 'B10'), 'PercentageGapInPayBetweenFemaleAndMaleEmployees');
      expect(gap?.applicable).toBe(false);
      expect(gap?.applicabilityCause?.threshold).toBe('150');

      await write(reportId, [headcount('150')]);
      const at = fieldOf(await readStep(reportId, 'B10'), 'PercentageGapInPayBetweenFemaleAndMaleEmployees');
      expect(at?.applicable).toBe(true);
    });

    it('nothing conditional applies before B1 is answered — a served default is not one (UX-9; task 91.2)', async () => {
      const reportId = await createReport(await openPeriod(2026));

      // The entity's `10.71` reaches B1 as a *default* and the store holds nothing, so the water
      // rule reads no answer. A default that drove applicability would be the second source of
      // truth §6.5 rules out — and the shape of the report would then depend on the entity record.
      expect(defaultOf(await readStep(reportId), ACTIVITY_CODES)).not.toBeNull();
      const water = fieldOf(await readStep(reportId, 'B6'), WATER_CONSUMPTION);
      expect(water?.applicable).toBe(false);
      expect(water?.applicabilityCause?.answer).toBeNull();
      expect(fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE)?.applicable).toBe(false);
    });

    it('applies water to a manufacturer through descent, and not to a retailer (BR-APP-4)', async () => {
      const reportId = await createReport(await openPeriod(2026));

      // `10.71` is bakery products — four levels under manufacturing, whose section the rule names.
      await write(reportId, [
        { elementKey: ACTIVITY_CODES, valueText: 'nace:NACE_C1071', state: DISCLOSURE_STATE.OK },
      ]);
      expect(fieldOf(await readStep(reportId, 'B6'), WATER_CONSUMPTION)?.applicable).toBe(true);
      expect((await moduleOf(reportId, 'B6'))?.applicable).toBe(true);

      await write(reportId, [
        { elementKey: ACTIVITY_CODES, valueText: 'nace:NACE_G4711', state: DISCLOSURE_STATE.OK },
      ]);
      const step = await readStep(reportId, 'B6');
      // One rule governs all four of B6's elements, so the module goes whole — and carries the one
      // cause its elements agree on.
      expect(step.fields.every((f) => !f.applicable)).toBe(true);
      const b6 = await moduleOf(reportId, 'B6');
      expect(b6?.applicable).toBe(false);
      expect(b6?.applicabilityCause).toMatchObject({ condition: 'member_within', answer: 'nace:NACE_G4711' });
      // Counted into neither side: a retailer must not be shown a denominator they cannot reach.
      expect({ answered: b6?.answered, total: b6?.total }).toEqual({ answered: 0, total: 0 });
    });

    it('brings B5’s site fields in once B1 lists a site, leaving the rest of the module alone (BR-APP-3)', async () => {
      const reportId = await createReport(await openPeriod(2026));

      const before = await readStep(reportId, 'B5');
      expect(fieldOf(before, BIODIVERSITY)?.applicable).toBe(false);
      // The undimensioned disclosures carry no rule: a company with no site still records the
      // negative determination UC-23's alternate flow requires, so the module stays.
      expect(fieldOf(before, 'TotalUseOfLand')?.applicable).toBe(true);
      expect((await moduleOf(reportId, 'B5'))?.applicable).toBe(true);

      // A site row carrying only a GPS fix is a site — which is why the rule reads five elements.
      await write(reportId, [
        { elementKey: 'GPSLocationOfSite', valueText: '47.0105 28.8638', state: DISCLOSURE_STATE.OK },
      ]);
      expect(fieldOf(await readStep(reportId, 'B5'), BIODIVERSITY)?.applicable).toBe(true);
    });

    it('retains a value under a field that stops applying, and hands it back marked (UX-28)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await write(reportId, [headcount('200')]);
      await write(reportId, [{ elementKey: TURNOVER_RATE, valueNumeric: '12.5', state: DISCLOSURE_STATE.OK }]);
      expect((await moduleOf(reportId, 'B8'))?.answered).toBe(1);

      await write(reportId, [headcount('40')]);
      const retained = fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE);
      // Retained, not dropped: the value is served exactly as stored, and `applicable: false`
      // beside a state that is not `missing` is the whole of the retention signal.
      expect(retained?.applicable).toBe(false);
      expect(retained?.valueNumeric).toBe('12.5');
      expect(retained?.state).toBe(DISCLOSURE_STATE.OK);
      // And it counts toward nothing while it does not apply, so B8's progress is honest.
      expect((await moduleOf(reportId, 'B8'))?.answered).toBe(0);

      // Writing to it is not refused (BR-APP-5): rejecting a field nobody was shown is the
      // "presented and later rejected" the rule exists to prevent.
      await write(reportId, [{ elementKey: TURNOVER_RATE, valueNumeric: '13', state: DISCLOSURE_STATE.OK }]);
    });

    it('takes a threshold change from the store, with no redeploy and no restart (FR-72, UC-81)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await write(reportId, [headcount('40')]);
      expect(fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE)?.applicable).toBe(false);

      const shipped = app.get(ConfigurationStore).get({
        kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
        scope: TAXONOMY_STANDARD.VSME,
      });
      const rules = (shipped?.payload as { rules: { condition: Record<string, unknown> }[] }).rules;
      try {
        await app.get(ConfigurationPublisher).publish({
          kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
          scope: TAXONOMY_STANDARD.VSME,
          payload: {
            rules: rules.map((rule) =>
              rule.condition.threshold === '50'
                ? { ...rule, condition: { ...rule.condition, threshold: '20' } }
                : rule,
            ),
          },
        });
        await app.get(ConfigurationStore).refreshIfStale();

        const moved = fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE);
        expect(moved?.applicable).toBe(true);
        expect(moved?.applicabilityCause?.threshold).toBe('20');
      } finally {
        // Restored in the file's own words, not deleted: the store keeps every revision, and the
        // next suite reads what `config/seed` ships.
        await app.get(ConfigurationPublisher).publish({
          kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
          scope: TAXONOMY_STANDARD.VSME,
          payload: shipped?.payload ?? { rules },
        });
        await app.get(ConfigurationStore).refreshIfStale();
      }
      expect(fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE)?.applicable).toBe(false);
    });
  });
});

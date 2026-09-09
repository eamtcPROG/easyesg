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
    dimensionKey: string; dimensionLabel: string | null; origin: string;
    valueText: string | null; valueNumeric: string | null; state: string; carriedForward: boolean;
    unitCode: string | null; unitCodes: string[];
    help: string | null;
    options: { value: string; label: string | null; code: string | null }[] | null;
    defaultValue: { valueText: string | null; valueNumeric: string | null } | null;
    applicable: boolean;
    applicabilityCause: Cause | null;
  }
  interface Axis { key: string; label: string | null; memberLanguage: string | null; members: { value: string; label: string | null; code: string | null; hazardous: boolean | null }[] }
  interface DerivationInput {
    key: string;
    derives: string;
    value: string | null;
    offered: string | null;
  }
  interface Step {
    module: string;
    taxonomyVersion: string;
    fields: Field[];
    axes: Axis[];
    derivationInputs: DerivationInput[];
  }

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

    const written = objectsOf<{ updatedAt: number }>((await http()
      .put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: B1_ELEMENT, valueText: 'Individual', state: DISCLOSURE_STATE.OK }],
      }).expect(200)).body);

    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    const b1 = modules.find((m) => m.module === 'B1');
    // Epoch milliseconds, from the store's own `updated_at` — derived, never written separately,
    // which is what the equality says: the summary reports the row's stamp to the millisecond.
    //
    // **Compared against the write's own answer, never against `Date.now()`** (4 Sep 2026). This
    // read `before <= lastAnsweredAt <= Date.now()` with `before` taken here, and those are two
    // different clocks: `updated_at` defaults to PostgreSQL's `now()`, generated inside the Compose
    // container, while `Date.now()` is the host's. Measured from the host over a persistent
    // connection, 40 round trips with no `docker exec` latency in the way, the container's clock ran
    // up to **2 ms behind** Node's — and the suite failed on a 4 ms deficit. A bracket between two
    // clocks is only correct while they agree to the millisecond, and `now()` being *transaction
    // start* time widens the same gap. Nothing here needed the host's clock: what FR-39 claims is
    // that the position comes from the values, which is a statement about two database values.
    expect(typeof written[0]?.updatedAt).toBe('number');
    expect(b1?.lastAnsweredAt).toBe(written[0]?.updatedAt);
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
    expect(basis?.options?.some((o) => /\[(?:member|abstract)\]/u.test(o.label ?? ''))).toBe(false);

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
    // **And every sibling grows with it** (task 36.6). A typed axis identifies a *thing*, so the
    // third site's address has to be enterable — measured before this task at 2 rows against
    // `CityOfSite`'s 3, which made it unanswerable through the wizard with nothing failing.
    expect(rowsOf(grown, 'AddressOfSite').map((f) => f.ordinal)).toEqual([0, 1, 2]);
    expect(rowsOf(grown, 'GPSLocationOfSite').map((f) => f.ordinal)).toEqual([0, 1, 2]);

    // **The site reaches B5, which shares the axis** — `design_spec.md` §6.1's *site-driven from
    // the B1 site geolocations*, and UC-23's *using the B1 site geolocations*. Three sites, three
    // rows, each named by the report's own answer rather than by its position alone.
    const b5 = await readStep(reportId, 'B5');
    expect(
      rowsOf(b5, 'SiteLocatedInABiodiversitySensitiveArea').map((f) => [f.ordinal, f.dimensionLabel]),
    ).toEqual([
      // **The first *text* element on the axis with a value, in the standard's own presentation
      // order** — `AddressOfSite` (1), `PostalCodeOfSite` (4), `CityOfSite` (5),
      // `GPSLocationOfSite` (7). `CountryOfSite` is an `enumeration` and is excluded: it stores a
      // member key, and a key may not reach a reader.
      //
      // So the Orhei site — which the entity gave a GPS fix and no street address — is named by its
      // **city** rather than by a coordinate pair, because the order reaches `CityOfSite` first.
      // That is presentation order doing something useful rather than merely being deterministic,
      // and it is why no per-axis naming vocabulary had to be invented.
      [0, 'Orhei'],
      [1, 'str. Decebal 1'],
      // The third site is the reporter's own, added by answering its city alone.
      [2, 'Cahul'],
    ]);
    const modules = objectsOf<ModuleSummary>((await http()
      .get(`/api/v1/reports/${reportId}/modules`).set(editor.authorization).expect(200)).body);
    expect(modules.find((m) => m.module === 'B1')?.answered).toBe(1);
  });

  /**
   * What names a typed-axis row when several elements have something (task 36.6).
   *
   * **The case both of this task's first tests were blind to** (convention and spec reviews, 8 Sep
   * 2026). The api case exercised only the snapshot's defaults, which were already first-wins, and
   * the browser fixture gives a site a locality and nothing else — so a stored pass written
   * *last*-wins passed both while naming every site by its coordinate pair, which is the one
   * outcome the presentation order exists to avoid. It is not an edge case: the browser commits
   * B1's shown defaults on arrival (FR-27, UX-34), so an ordinary site holds all four.
   */
  it('names a site by the first text element that has something, not the last', async () => {
    const reportId = await createReport(await openPeriod(2026));
    // Deliberately written in reverse presentation order, so a reader cannot mistake insertion
    // order for the rule: GPS (7), city (5), postal code (4), address (1).
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [
        ['GPSLocationOfSite', '47.0105 28.8638'],
        ['CityOfSite', 'Chișinău'],
        ['PostalCodeOfSite', 'MD-2001'],
        ['AddressOfSite', 'str. Bănulescu-Bodoni 57'],
      ].map(([elementKey, valueText]) => ({
        elementKey, ordinal: 0, valueText, state: DISCLOSURE_STATE.OK, carriedForward: false,
      })),
    }).expect(200);

    const named = (step: Step, elementKey: string): string | null =>
      step.fields.find((f) => f.elementKey === elementKey)?.dimensionLabel ?? null;

    // `AddressOfSite` is order 1 in its section, so it names the row on both steps that share the
    // axis — B1, where the answers live, and B5, which is asking about the same site.
    expect(named(await readStep(reportId), 'AddressOfSite')).toBe('str. Bănulescu-Bodoni 57');
    expect(named(await readStep(reportId, 'B5'), 'SiteLocatedInABiodiversitySensitiveArea'))
      .toBe('str. Bănulescu-Bodoni 57');

    // Clearing the winner hands the name on to the next element in order — the postal code.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'AddressOfSite', ordinal: 0, state: DISCLOSURE_STATE.MISSING, carriedForward: false }],
    }).expect(200);
    expect(named(await readStep(reportId, 'B5'), 'SiteLocatedInABiodiversitySensitiveArea')).toBe('MD-2001');
  });

  /**
   * Clearing an answer suppresses **that element's snapshot default** rather than falling back to
   * it (task 36.6).
   *
   * **A separate case because the one above cannot reach it** (found by mutation, 8 Sep 2026): its
   * entity has no sites, so no element has a default to fall back to, and the clearing assertion
   * there passes whether or not the suppression exists. This is the step read's own rule — *a row
   * in any state suppresses the default, because cleared is a decision* — applied to what names a
   * row, and it needs a snapshot site to be visible at all.
   */
  it('a cleared answer suppresses its own snapshot default, and the name hands on', async () => {
    const created = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Grupul Rezina', legalForm: 'sa', naceCodes: ['10.71'],
      sites: [{ name: 'Sediu', locality: 'Rezina', addressLine1: 'str. Păcii 3', countryCode: 'MD' }],
    }).expect(201);
    const entity = (created.body as { object: { id: string } }).object.id;
    const period = (await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entity, fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201)).body as { object: { id: string } };
    const reportId = await createReport(period.object.id);

    const siteName = async (): Promise<string | null> =>
      (await readStep(reportId, 'B5')).fields.find(
        (f) => f.elementKey === 'SiteLocatedInABiodiversitySensitiveArea',
      )?.dimensionLabel ?? null;

    // The snapshot names it, because nothing is stored yet — which is what §7.2 means by the
    // snapshot being the *default*, and what this row's first record wrongly denied.
    expect(await siteName()).toBe('str. Păcii 3');

    // The reporter clears the address. The default it was offered is gone with it, so the name
    // hands on to the next element in presentation order — the city, also from the snapshot.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [{ elementKey: 'AddressOfSite', ordinal: 0, state: DISCLOSURE_STATE.MISSING, carriedForward: false }],
    }).expect(200);
    expect(await siteName()).toBe('Rezina');

    // Clear every text answer and the row keeps its position and loses its name — `Amplasament 1`
    // with nothing after it, rather than a site still wearing a description nobody stands behind.
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: ['CityOfSite', 'PostalCodeOfSite', 'GPSLocationOfSite'].map((elementKey) => ({
        elementKey, ordinal: 0, state: DISCLOSURE_STATE.MISSING, carriedForward: false,
      })),
    }).expect(200);
    expect(await siteName()).toBeNull();
    // And the row is still there to be answered again.
    expect(
      (await readStep(reportId, 'B5')).fields.filter(
        (f) => f.elementKey === 'SiteLocatedInABiodiversitySensitiveArea',
      ),
    ).toHaveLength(1);
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
   * A **breakdown axis** renders one row per member (UC-21; task 36.4).
   *
   * B3's three energy elements sit on `BreakdownOfEnergyConsumptionAxis`, and UC-21 step 1 asks for
   * consumption *"split by renewable and non-renewable source"* — which was unreportable until this
   * task: task 91.2 gave typed axes their ordinals and left the 34 elements on explicit axes at one
   * undimensioned row.
   *
   * **Which axes expand is configuration** (`disclosure_axis_shape`), because EFRAG's package does
   * not distinguish a breakdown from a classification and rendering them alike is wrong in both
   * directions — B4's 94 pollutants as 94 rows is not a screen. So the second case here is as much
   * the deliverable as the first: an axis nobody registered stays exactly as it was.
   */
  /**
   * The eight disclosures EFRAG presents in B3 **and** C3 — one shared hypercube (task 36.4).
   * Declared as the whole set rather than a sample, so an element dropping out of it fails.
   */
  const SHARED_WITH_C3 = [
    'GrossLocationBasedScope2GreenhouseGasEmissions',
    'GrossMarketBasedScope2GreenhouseGasEmissions',
    'GrossScope1GreenhouseGasEmissions',
    'GrossScope3GreenhouseGasEmissions',
    'TotalGrossLocationBasedGHGEmissions',
    'TotalGrossLocationBasedScope1AndScope2GHGEmissions',
    'TotalGrossMarketBasedGHGEmissions',
    'TotalGrossMarketBasedScope1AndScope2GHGEmissions',
  ];

  describe('a breakdown axis renders one row per member (UC-21, task 36.4)', () => {
    it('gives each energy element the total and both sources, named in the reader’s language', async () => {
      const reportId = await createReport(await openPeriod(2026));
      const step = objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/B3`)
          .set(editor.authorization)
          .expect(200)).body,
      );

      const fuels = step.fields.filter((f) => f.elementKey === 'EnergyConsumptionFromFuels');
      expect(fuels).toHaveLength(3);
      // The default member leads: it is the member a fact carrying no dimension means — the total —
      // so a reader meets the whole before its parts. Not UC-21's ordering: it names the split
      // and no total.
      expect(fuels.map((f) => f.dimensionKey)).toEqual([
        'TotalRenewableAndNonRenewableEnergyMember',
        'RenewableEnergyMember',
        'NonRenewableEnergyMember',
      ]);
      // **The label, not the key.** `RenewableEnergyMember` on a screen is the internal identifier
      // the user-facing-text rule forbids, and until this task no catalogue named these at all.
      expect(fuels.map((f) => f.dimensionLabel)).toEqual([
        'Total energie regenerabilă și neregenerabilă',
        'Energie regenerabilă',
        'Energie neregenerabilă',
      ]);
      // Not a repeating group: a reporter cannot add a fourth kind of energy (task 91.2's shape).
      expect(fuels.every((f) => f.repeating === false)).toBe(true);
      expect(fuels.every((f) => f.ordinal === 0)).toBe(true);
    });

    /**
     * **The step read selects by membership, not by equality** (task 36.4).
     *
     * Eight disclosures are presented in B3 *and* C3, so `element.module === query.module` served a
     * B3 step without FR-34's own fields — *"the results appear in the B3 fields"* — while the
     * artefact, the registry and every hermetic assertion agreed. The sibling case in
     * `taxonomy-artefact.spec.ts` pins the artefact; this pins the read, and a regression to `===`
     * fails here and passes there.
     */
    it('serves the emissions FR-34 writes into, which B3 shares with C3', async () => {
      const reportId = await createReport(await openPeriod(2026));
      const step = objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/B3`)
          .set(editor.authorization)
          .expect(200)).body,
      );

      const served = new Set(step.fields.map((f) => f.elementKey));
      for (const key of SHARED_WITH_C3) {
        expect({ key, servedOnB3: served.has(key) }).toEqual({ key, servedOnB3: true });
      }

      // **And C3, which is the arm that actually breaks** (gate-integrity review, 8 Sep 2026). The
      // first version of this case read B3 alone and its comment claimed it guarded a reversion to
      // `===`. It does not: `modules` is sorted, so a shared element's first module is always `B3`
      // and `modules[0] === query.module` serves this step correctly while emptying C3's of all
      // eight. The scalar's damage was always on the second module — that is the whole shape of the
      // defect — so the second module is what has to be read.
      const comprehensive = objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/C3`)
          .set(editor.authorization)
          .expect(200)).body,
      );
      const onC3 = new Set(comprehensive.fields.map((f) => f.elementKey));
      for (const key of SHARED_WITH_C3) {
        expect({ key, servedOnC3: onC3.has(key) }).toEqual({ key, servedOnC3: true });
      }

      // `ReportingScopesAxis` is baseline / target / currently-stated — C3's framing of the same
      // figures, and deliberately not a registered breakdown (see `disclosure.constants.ts`). On B3
      // the reporter states the current figure, which is the default member: one undimensioned row.
      const scope1 = step.fields.filter((f) => f.elementKey === 'GrossScope1GreenhouseGasEmissions');
      expect(scope1.map((f) => f.dimensionKey)).toEqual(['']);
    });

    /**
     * **`origin` is read back from the column, not defaulted into the response** (gate-integrity
     * review, 8 Sep 2026).
     *
     * Nothing writes anything but `reported` until task 39.2, so every assertion about the seam was
     * satisfied by the fallback: dropping `origin` from the store's `VALUE_COLUMNS` left `row.origin`
     * `undefined`, `value?.origin ?? DEFAULT_DISCLOSURE_ORIGIN` recovered `'reported'`, and
     * typecheck and 63 e2e cases stayed green. The column's whole justification is being the seam
     * 39.2 writes into, so the seam has to be shown to conduct — which needs a row whose origin is
     * *not* the default, and the migration's `GRANT UPDATE (origin)` is what makes one reachable.
     */
    it('serves a calculated origin the store actually holds, not the column default', async () => {
      const reportId = await createReport(await openPeriod(2026));
      const element = 'TotalEnergyConsumption';

      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{ elementKey: element, valueNumeric: '412.5', state: DISCLOSURE_STATE.OK }],
      }).expect(200);

      const before = objectOf<Step>(
        (await http().get(`/api/v1/reports/${reportId}/modules/B3`).set(editor.authorization).expect(200)).body,
      );
      expect(before.fields.find((f) => f.elementKey === element)?.origin).toBe('reported');

      // What 39.2 will do, standing in for it: the one column `esg_app` may move on a stored value.
      await asOrganization(owner, ORG, (run) =>
        run(
          `UPDATE core.report_disclosure_value SET origin = 'calculated'
            WHERE report_id = $1 AND element_key = $2`,
          [reportId, element],
        ),
      );

      const after = objectOf<Step>(
        (await http().get(`/api/v1/reports/${reportId}/modules/B3`).set(editor.authorization).expect(200)).body,
      );
      expect(after.fields.find((f) => f.elementKey === element)?.origin).toBe('calculated');
    });

    /**
     * **Retitled at task 36.5, because the shape it described stopped being produced.** It read
     * *"leaves an axis nobody registered as one undimensioned row"* — true when a classification
     * had no rendering at all, and now a claim about the old behaviour that would have stayed
     * green while saying the opposite of what ships. What survives is the *count*: an axis nobody
     * registered as a breakdown must not expand, and 94 pollutants × 3 elements is the defect.
     */
    it('does not expand a classification into a row per member, however many it admits', async () => {
      const reportId = await createReport(await openPeriod(2026));
      const step = objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/B4`)
          .set(editor.authorization)
          .expect(200)).body,
      );

      // Exactly three — `AmountOfEmissionTo{Air,Soil,Water}`, one unassigned row each. A knowable
      // count rather than a vacuity guard, so registering `TypeOfPollutantAxis` as a breakdown
      // fails here and gets read, instead of quietly satisfying `> 0` with 282 rows.
      const dimensioned = step.fields.filter((f) => f.axes.includes('TypeOfPollutantAxis'));
      expect(dimensioned).toHaveLength(3);
      // `dimensionKey` empty on a *dimensioned* element is task 36.5's *no member chosen yet* — the
      // template row that lets a module be started, not the undimensioned row an unaxed field has.
      expect(dimensioned.every((f) => f.dimensionKey === '')).toBe(true);
      expect(dimensioned.every((f) => f.dimensionLabel === null)).toBe(true);
    });
  });

  /**
   * B4's classification — a row whose identity is a **chosen member** (UC-22, task 36.5).
   *
   * The third row shape, and the one no task had built. A *breakdown* fixes its rows and a *typed*
   * axis numbers them; a classification is selected from, which is why 94 pollutants must not
   * become 94 rows and why the rows a step serves are the ones a report actually holds.
   */
  describe('a classification is selected from, not answered for every member (UC-22)', () => {
    const stepOf = async (reportId: string, module: string): Promise<Step> =>
      objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/${module}`)
          .set(editor.authorization)
          .expect(200)).body,
      );

    it('carries the pollutant domain once on the step, not on each of the three fields', async () => {
      const step = await stepOf(await createReport(await openPeriod(2026)), 'B4');

      expect(step.axes.map((axis) => axis.key)).toEqual(['TypeOfPollutantAxis']);
      const pollutants = step.axes[0];
      // 94 members — EFRAG's list, and the reason this is on the step: three elements share it, so
      // a per-field copy would put 282 objects on the wire, and B7's waste axis 973 × N.
      expect(pollutants.members).toHaveLength(94);
      // The axis names itself from its default member, so a screen can head the table without
      // inventing a word. Never the axis key, which is an XBRL identifier.
      expect(pollutants.label).toBe('Tipul de poluant');
      // Romanian, because the read negotiates a locale and these accounts have no other — which
      // is what shows the member wording is the catalogue's rather than the artefact's English.
      expect(pollutants.members.slice(0, 2)).toEqual([
        // `hazardous: null` rather than `false` — a pollutant is not *non-hazardous*, it is outside
        // a classification that makes EFRAG's hazardous/non-hazardous distinction at all (36.8).
        { value: 'AlachlorMember', label: 'Alaclor', code: null, hazardous: null },
        { value: 'AldrinMember', label: 'Aldrin', code: null, hazardous: null },
      ]);
      // **The default member is not offered**, and that is the decision rather than an omission: it
      // is the domain's root — *Type of pollutant* — so an amount filed against it would be filed
      // against the category rather than against a pollutant.
      expect(pollutants.members.map((m) => m.value)).not.toContain('TypeOfPollutantMember');
    });

    it('serves every element a cell for every pollutant the report names, as the template does', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [
          {
            elementKey: 'AmountOfEmissionToAir',
            dimensionKey: 'AmmoniaNH3Member',
            ordinal: 0,
            valueNumeric: '12',
            unitCode: 't',
            state: DISCLOSURE_STATE.OK,
            carriedForward: false,
          },
          {
            elementKey: 'AmountOfEmissionToWater',
            dimensionKey: 'AlachlorMember',
            ordinal: 0,
            valueNumeric: '3',
            unitCode: 'kg',
            state: DISCLOSURE_STATE.OK,
            carriedForward: false,
          },
        ],
      }).expect(200);

      const step = await stepOf(reportId, 'B4');
      const rows = step.fields
        .filter((f) => f.axes.includes('TypeOfPollutantAxis'))
        .map((f) => ({ element: f.elementKey, member: f.dimensionKey, name: f.dimensionLabel, value: f.valueNumeric }));

      // **Two pollutants named, so all three elements answer for both** — EFRAG's B4 sheet is a
      // table headed `Row ID │ Pollutant │ air │ water │ soil`, and a reporter who names ammonia is
      // being asked all three amounts for it. The four cells nobody filled are empty rather than
      // absent, which is what distinguishes *not emitted* from *pollutant not named*.
      //
      // **Exactly this set**, so a classification that quietly expanded to 94 members fails, and so
      // does one that served each element only its own stored rows — the ragged shape no client
      // could lay out as a table.
      expect(rows).toEqual([
        { element: 'AmountOfEmissionToAir', member: 'AlachlorMember', name: 'Alaclor', value: null },
        { element: 'AmountOfEmissionToAir', member: 'AmmoniaNH3Member', name: 'Amoniac (NH3)', value: '12' },
        { element: 'AmountOfEmissionToWater', member: 'AlachlorMember', name: 'Alaclor', value: '3' },
        { element: 'AmountOfEmissionToWater', member: 'AmmoniaNH3Member', name: 'Amoniac (NH3)', value: null },
        { element: 'AmountOfEmissionToSoil', member: 'AlachlorMember', name: 'Alaclor', value: null },
        { element: 'AmountOfEmissionToSoil', member: 'AmmoniaNH3Member', name: 'Amoniac (NH3)', value: null },
      ]);
    });

    it('serves one row per member a single element holds, in a stable order', async () => {
      const reportId = await createReport(await openPeriod(2026));
      // Written out of alphabetical order deliberately: the rows must not come back in whatever
      // order the store's plan chose, or one report renders two ways.
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: ['MercuryAndCompoundsHgMember', 'AlachlorMember', 'AsbestosMember'].map((dimensionKey) => ({
          elementKey: 'AmountOfEmissionToAir',
          dimensionKey,
          ordinal: 0,
          valueNumeric: '1',
          unitCode: 'kg',
          state: DISCLOSURE_STATE.OK,
          carriedForward: false,
        })),
      }).expect(200);

      const air = (await stepOf(reportId, 'B4')).fields.filter(
        (f) => f.elementKey === 'AmountOfEmissionToAir',
      );
      expect(air.map((f) => f.dimensionKey)).toEqual([
        'AlachlorMember',
        'AsbestosMember',
        'MercuryAndCompoundsHgMember',
      ]);
      // The unassigned row is gone once the reporter has answered: adding another is the browser's
      // to offer, and serving a spare here would put an empty row under every table forever.
      expect(air.map((f) => f.dimensionKey)).not.toContain('');
    });

    it('refuses a value under a member the axis does not declare, below the browser', async () => {
      // **P-4, and it became reachable with this task.** A classification derives its rows from the
      // store, so a stray `dimension_key` is no longer merely unread — it draws a visible row on
      // every element of the axis, labelled *unnamed*. The browser will not send one; a guarantee
      // that lives in one client is the inversion this repository refuses.
      const reportId = await createReport(await openPeriod(2026));
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{
          elementKey: 'AmountOfEmissionToAir',
          dimensionKey: 'NotAPollutantMember',
          ordinal: 0,
          valueNumeric: '12',
          state: DISCLOSURE_STATE.OK,
          carriedForward: false,
        }],
      }).expect(400);

      // Nothing was written, so nothing can be drawn from it — the batch is all-or-nothing about
      // what it names, exactly as the element check above it is.
      const step = await stepOf(reportId, 'B4');
      expect(step.fields.filter((f) => f.dimensionKey !== '')).toEqual([]);
    });

    it('draws no row for a stored member the axis does not declare', async () => {
      // **Written through SQL because the write guard above makes it unreachable through the API**,
      // which is the point: the read guard is defence in depth for a row that arrives by any other
      // path — a migration, a future writer, an operator. Before task 36.5 a stray `dimension_key`
      // was simply never asked for; now the rows come FROM the store, so an unvalidated string
      // would materialise as a visible row on all three of B4's elements, labelled *unnamed*.
      const reportId = await createReport(await openPeriod(2026));
      await asOrganization(owner, ORG, (run) =>
        run(
          `INSERT INTO core.report_disclosure_value
             (organization_id, report_id, element_key, dimension_key, ordinal, value_numeric, state)
           VALUES ($1, $2, 'AmountOfEmissionToAir', 'NotAPollutantMember', 0, 7, 'ok')`,
          [ORG, reportId],
        ),
      );

      const step = await stepOf(reportId, 'B4');
      // The unassigned template row and nothing else: the stray member neither draws its own row nor
      // adds a column to the other two elements.
      expect(step.fields.filter((f) => f.axes.includes('TypeOfPollutantAxis')).map((f) => f.dimensionKey))
        .toEqual(['', '', '']);
    });

    it('admits the undimensioned key, which three legitimate shapes carry', async () => {
      // `''` is what an unaxed element carries, what a typed axis's rows carry, and what an explicit
      // axis in neither registered shape carries — `ReportingScopesAxis`, whose default member IS
      // the answer. Refusing it to catch the case above would refuse all three.
      const reportId = await createReport(await openPeriod(2026));
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{
          elementKey: 'GrossScope1GreenhouseGasEmissions',
          dimensionKey: '',
          ordinal: 0,
          valueNumeric: '5',
          unitCode: 'tCO2e',
          state: DISCLOSURE_STATE.OK,
          carriedForward: false,
        }],
      }).expect(200);
    });

    it('offers B7 the waste list’s leaves, in the language EFRAG publishes them (UC-25)', async () => {
      const step = await stepOf(await createReport(await openPeriod(2026)), 'B7');

      expect(step.axes.map((a) => a.key)).toEqual(['TypeOfWasteAxis']);
      const waste = step.axes[0];

      // **842 of 973**, which is the whole of the leaf rule: the EU List of Waste is 20 chapters,
      // 111 sub-chapters and 842 entries, and EFRAG's own workbook says *"select a Type of waste
      // (Hazardous or Non-Hazardous) rather than a category else an ERROR message will appear."*
      expect(waste.members).toHaveLength(842);
      // A chapter and a sub-chapter, named to make the exclusion legible rather than a number.
      const offered = new Set(waste.members.map((m) => m.value));
      expect(offered.has('W-01-WastesResultingFromExplorationMiningQuarryingAndPhysicalAndChemicalTreatmentOfMineralsMember')).toBe(false);
      expect(offered.has('W-0101-WastesFromMineralExcavationMember')).toBe(false);
      expect(offered.has('W-010101-Non-Hazardous-WastesFromMineralMetalliferousExcavationMember')).toBe(true);

      // **English, and the wire says so.** Every one of the 973 members carries an `en` label and
      // nothing else, and this read asked in Romanian — so the picker will state it rather than let
      // a reporter meet an unexplained language switch. `null` here would mean *the reader's own*.
      expect(waste.memberLanguage).toBe('en');
      expect(waste.members.find((m) => m.code === '01 01 01')).toEqual({
        value: 'W-010101-Non-Hazardous-WastesFromMineralMetalliferousExcavationMember',
        label: 'Wastes from mineral metalliferous excavation',
        code: '01 01 01',
        // **EFRAG's own instruction cannot be followed without this** (spec review, 8 Sep 2026):
        // the workbook says to select a type of waste that is Hazardous or Non-Hazardous, and
        // nothing else a reader sees says which. The published list marks it with an asterisk on
        // the code — `01 03 04*` — which this platform's extracted code does not carry, and the
        // member key that does may not reach a reader.
        hazardous: false,
      });
      expect(waste.members.find((m) => m.code === '01 03 04')?.hazardous).toBe(true);
      // `null` rather than `false` where the classification makes no such distinction at all.
      const b4 = await stepOf(await createReport(await openPeriod(2027)), 'B4');
      expect(b4.axes[0]?.members[0]?.hazardous).toBeNull();
    });

    it('refuses a category at the write, not only at the picker', async () => {
      // **The leaf rule's third reader** (convention review, 8 Sep 2026). It reached `domainOf` and
      // left the write accepting a chapter — which would then draw a row on all six waste elements
      // *and* render `unnamed`, because the picker no longer carries it: strictly worse than not
      // having the rule. P-4 again — the client that must not send one is not the layer that can
      // guarantee nobody does.
      const reportId = await createReport(await openPeriod(2026));
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{
          elementKey: 'WasteDivertedToRecycleOrReuseMass',
          dimensionKey: 'W-0101-WastesFromMineralExcavationMember',
          ordinal: 0,
          valueNumeric: '5',
          state: DISCLOSURE_STATE.OK,
          carriedForward: false,
        }],
      }).expect(400);

      // And a leaf under the same chapter is accepted, so the refusal is about the category rather
      // than about the axis.
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
        values: [{
          elementKey: 'WasteDivertedToRecycleOrReuseMass',
          dimensionKey: 'W-010101-Non-Hazardous-WastesFromMineralMetalliferousExcavationMember',
          ordinal: 0,
          valueNumeric: '5',
          state: DISCLOSURE_STATE.OK,
          carriedForward: false,
        }],
      }).expect(200);
    });

    it('says nothing about language where the members are named in the reader’s own', async () => {
      // B4's pollutants are worded in the catalogues, so a Romanian read is answered in Romanian and
      // the note has nothing to announce. Without this, `memberLanguage` could be hardcoded to `en`
      // and the case above would not notice.
      const step = await stepOf(await createReport(await openPeriod(2026)), 'B4');
      expect(step.axes[0]?.memberLanguage).toBeNull();
    });

    it('renders every element on the waste axis, mass and volume alike (UC-25)', async () => {
      // Six, where EFRAG's sheet shows three quantity columns and a mass-or-volume switch — the
      // divergence `architecture.md` §12.5.6 records rather than designs around, because pairing
      // `…Mass` with `…Volume` is a rule no source states.
      const step = await stepOf(await createReport(await openPeriod(2026)), 'B7');
      expect(
        step.fields.filter((f) => f.axes.includes('TypeOfWasteAxis')).map((f) => f.elementKey).sort(),
      ).toEqual([
        'TotalWasteRecycledReusedAndDirectedToDisposalMass',
        'TotalWasteRecycledReusedAndDirectedToDisposalVolume',
        'WasteDirectedToDisposalMass',
        'WasteDirectedToDisposalVolume',
        'WasteDivertedToRecycleOrReuseMass',
        'WasteDivertedToRecycleOrReuseVolume',
      ]);
      // And the module carries its other thirteen — the two circularity fields, the six totals, the
      // material group and its two totals. A classification that swallowed the step would fail here.
      expect(step.fields.filter((f) => !f.axes.includes('TypeOfWasteAxis'))).toHaveLength(13);
    });

    it('names B8’s 256 countries in the reader’s language, which EFRAG does not (UC-26)', async () => {
      const step = await stepOf(await createReport(await openPeriod(2026)), 'B8');

      expect(step.axes.map((a) => a.key)).toEqual(['CountryOfEmploymentContractAxis']);
      const countries = step.axes[0];
      // 256 — the axis's own members. `AllCountriesMember` is its default and is excluded, as every
      // classification's root is: a headcount filed against *all countries* is filed against the
      // category rather than a member of it.
      expect(countries.members).toHaveLength(256);
      expect(countries.members.map((m) => m.value)).not.toContain('AllCountriesMember');

      // **Named by the platform, because nobody else names them.** Not one of the 257 has a label
      // in any catalogue — EFRAG *references* ISO 3166 rather than wording it — so before this task
      // the picker would have offered `AD, AE, AF`.
      const named = new Map(countries.members.map((m) => [m.value, m.label]));
      expect({ MD: named.get('MD'), FR: named.get('FR') }).toEqual({
        MD: 'Republica Moldova',
        FR: 'Franța',
      });
      // Romanian, because the read negotiates a locale — which is what shows the name is resolved
      // per request rather than baked in English somewhere.
      expect(countries.memberLanguage).toBeNull();

      // **`NT` is the one that does not resolve**: the Neutral Zone, withdrawn from ISO 3166 in
      // 1993 and still in EFRAG's list. `null` rather than the code echoed back as its own name,
      // which is the shape the user-facing-text rule refuses; the picker falls back to the code as
      // a reference, which that rule permits.
      expect(named.get('NT')).toBeNull();
      // And every other one is named, so a silently-empty resolver cannot pass this.
      expect([...named.values()].filter((label) => label === null)).toHaveLength(1);
    });

    it('offers no domain on a step that has no classification', async () => {
      // B3's axis is a registered breakdown and B1's are typed, so neither is selected from. An
      // empty list rather than a missing member: a client reads `axes` unconditionally.
      const reportId = await createReport(await openPeriod(2026));
      expect((await stepOf(reportId, 'B3')).axes).toEqual([]);
      expect((await stepOf(reportId, 'B1')).axes).toEqual([]);
    });
  });

  /**
   * UX-14's units, on the wire (task 91.4).
   *
   * The artefact spec holds the whole 38-element map hermetically; what only this level shows is
   * that the taxonomy's answer survives the registry's parse, the step read's join and the DTO —
   * four layers, each of which has a `unitCodes` of its own that could quietly answer `[]`.
   */
  describe('the units a field admits (UX-14, task 91.4)', () => {
    const unitsOn = async (module: string): Promise<Record<string, string[]>> => {
      const reportId = await createReport(await openPeriod(2026));
      const step = objectOf<Step>(
        (await http()
          .get(`/api/v1/reports/${reportId}/modules/${module}`)
          .set(editor.authorization)
          .expect(200)).body,
      );
      return Object.fromEntries(step.fields.map((field) => [field.elementKey, field.unitCodes]));
    };

    it('offers B4 a choice of kilograms or tonnes, and states none for its two other fields', async () => {
      const units = await unitsOn('B4');
      // EFRAG's own Digital Template asks this on its B4 sheet — *"either kg or tonne"*, with
      // tonnes pre-selected — which is why 91.4 was ordered before B4's module slice.
      expect(units).toEqual({
        AmountOfEmissionToAir: ['kg', 't'],
        AmountOfEmissionToWater: ['kg', 't'],
        AmountOfEmissionToSoil: ['kg', 't'],
        // A boolean and a URL take no unit at all, and `[]` is that answer rather than a gap.
        PubliclyAvailableDisclosure: [],
        URLOrLinkToThePubliclyAvailableDisclosure: [],
      });
    });

    it('states one unit for B3’s total energy and none for the two breakdown rows EFRAG omits', async () => {
      const units = await unitsOn('B3');
      // The asymmetry is EFRAG's, not this platform's, and it is the fact task 36.4 handed to this
      // one: the total states MWh, two of the three sources it decomposes into state nothing. A
      // reader of the screen sees a unit on one row of a breakdown and none on the others.
      expect({
        total: units.TotalEnergyConsumption,
        electricity: units.EnergyConsumptionFromElectricity,
        fuels: units.EnergyConsumptionFromFuels,
        selfGenerated: units.EnergyConsumptionFromSelfGeneratedElectricity,
        scopeOne: units.GrossScope1GreenhouseGasEmissions,
      }).toEqual({
        total: ['MWh'],
        electricity: ['MWh'],
        fuels: [],
        selfGenerated: [],
        scopeOne: ['tCO2e'],
      });
    });

    it('states no unit for the intensities, whose guidance is a ratio rather than a list', async () => {
      // The trap the parser is a shape test for: EFRAG's guidance here is a sentence naming tCO₂e
      // as the NUMERATOR over an ISO 4217 denominator, so a token scrape would answer `['tCO2e']`
      // and a screen would offer a ratio the unit of its top half.
      const units = await unitsOn('B3');
      expect({
        location: units.Scope1AndScope2GreenhouseGasEmissionsIntensityValueLocationBased,
        market: units.Scope1AndScope2GreenhouseGasEmissionsIntensityValueMarketBased,
      }).toEqual({ location: [], market: [] });
    });
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
      // **Through its inputs since task 36.10**: the turnover rate is derived, so this test used to
      // write a figure the api now refuses (FR-29). The act being tested is unchanged — a field
      // acquires a value and then stops applying — and it now runs the path a reporter runs.
      await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization)
        .send({ values: [
          { inputKey: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', valueNumeric: '12' },
          { inputKey: 'NumberOfEmployeesAtTheBeginningOfTheReportingPeriod', valueNumeric: '100' },
          { inputKey: 'NumberOfEmployeesAtTheEndOfTheReportingPeriod', valueNumeric: '92' },
        ] }).expect(204);
      expect((await moduleOf(reportId, 'B8'))?.answered).toBe(1);

      await write(reportId, [headcount('40')]);
      const retained = fieldOf(await readStep(reportId, 'B8'), TURNOVER_RATE);
      // Retained, not dropped: the value is served exactly as stored, and `applicable: false`
      // beside a state that is not `missing` is the whole of the retention signal.
      expect(retained?.applicable).toBe(false);
      // 12 ÷ ((100 + 92) ÷ 2) = 0.125
      expect(Number(retained?.valueNumeric)).toBeCloseTo(0.125, 6);
      expect(retained?.state).toBe(DISCLOSURE_STATE.OK);
      // And it counts toward nothing while it does not apply, so B8's progress is honest.
      expect((await moduleOf(reportId, 'B8'))?.answered).toBe(0);

      // Writing to it is not refused *on applicability grounds* (BR-APP-5): rejecting a field
      // nobody was shown is the "presented and later rejected" the rule exists to prevent. The
      // equivalent act is now writing an input, since the figure itself is the platform's to set.
      await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization)
        .send({ values: [{ inputKey: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', valueNumeric: '13' }] })
        .expect(204);
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
  /**
   * The figures EFRAG's template computes rather than asks for (task 36.10; UC-26, UC-27, FR-29).
   *
   * Over real HTTP and a real database, because the interesting part is not the arithmetic — that is
   * unit-tested against the workbook's own cells — but that a value written through one endpoint
   * changes a figure served by another, with the right provenance and the right state.
   */
  describe('derived figures (FR-29, FR-30)', () => {
    const ACCIDENT_RATE = 'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod';
    const ACCIDENTS = 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod';
    const FATALITIES = 'NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth';
    const HOURS = 'HoursWorkedByOneFullTimeEmployee';

    const put = async (reportId: string, values: Record<string, unknown>[]): Promise<void> => {
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
        .send({ values }).expect(200);
    };
    const putInputs = async (
      reportId: string,
      values: Record<string, unknown>[],
      status = 204,
    ): Promise<void> => {
      await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization)
        .send({ values }).expect(status);
    };
    const field = (step: Step, elementKey: string): Field | undefined =>
      step.fields.find((f) => f.elementKey === elementKey);

    it('serves B9’s hours input with EFRAG’s published offer and no stored value (UC-27)', async () => {
      const step = await readStep(await createReport(await openPeriod(2026)), 'B9');
      const inputs = step.derivationInputs;
      expect(inputs.map((i) => i.key)).toEqual([HOURS]);
      // The offer is served; the value is not. A reporter who has never looked at the field is
      // distinguishable from one who typed 2000, which is the whole reason they are two properties.
      expect(inputs[0]).toMatchObject({ derives: ACCIDENT_RATE, value: null, offered: '2000' });
    });

    it('puts B8’s three turnover inputs on B8 and nothing on B2', async () => {
      const reportId = await createReport(await openPeriod(2026));
      expect((await readStep(reportId, 'B8')).derivationInputs.map((i) => i.key).sort()).toEqual([
        'NumberOfEmployeesAtTheBeginningOfTheReportingPeriod',
        'NumberOfEmployeesAtTheEndOfTheReportingPeriod',
        'NumberOfEmployeesWhoLeftDuringTheReportingPeriod',
      ]);
      // A report has one of each input; a step is a screen. B2 derives nothing.
      expect((await readStep(reportId, 'B2')).derivationInputs).toEqual([]);
    });

    it('derives B9’s rate from the accident count, the offered hours and B1’s headcount', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        { elementKey: ACCIDENTS, valueNumeric: '3', state: DISCLOSURE_STATE.OK },
      ]);
      // Nobody touched the hours field, so the published 2 000 is what it computes with — which is
      // what makes the offer reachable without writing a number on the reporter's behalf.
      const rate = field(await readStep(reportId, 'B9'), ACCIDENT_RATE);
      expect(Number(rate?.valueNumeric)).toBeCloseTo(6, 6);
      expect(rate?.origin).toBe('calculated');
    });

    it('follows the hours figure when the reporter states their own working year', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        { elementKey: ACCIDENTS, valueNumeric: '3', state: DISCLOSURE_STATE.OK },
      ]);
      await putInputs(reportId, [{ inputKey: HOURS, valueNumeric: '1500' }]);
      const step = await readStep(reportId, 'B9');
      // 3 ÷ (1500 × 50) × 200000 = 8, against 6 at EFRAG's default.
      expect(Number(field(step, ACCIDENT_RATE)?.valueNumeric)).toBeCloseTo(8, 6);
      // And the stored answer is served back beside the offer it replaced, not instead of it.
      expect(step.derivationInputs[0]).toMatchObject({ value: '1500', offered: '2000' });
    });

    it('clears the input back to the offer when the value is null', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        { elementKey: ACCIDENTS, valueNumeric: '3', state: DISCLOSURE_STATE.OK },
      ]);
      await putInputs(reportId, [{ inputKey: HOURS, valueNumeric: '1500' }]);
      await putInputs(reportId, [{ inputKey: HOURS, valueNumeric: null }]);
      const step = await readStep(reportId, 'B9');
      expect(step.derivationInputs[0]).toMatchObject({ value: null, offered: '2000' });
      expect(Number(field(step, ACCIDENT_RATE)?.valueNumeric)).toBeCloseTo(6, 6);
    });

    it('derives B8’s turnover from its three inputs, none of which is a disclosure', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [{ elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK }]);
      await putInputs(reportId, [
        { inputKey: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', valueNumeric: '12' },
        { inputKey: 'NumberOfEmployeesAtTheBeginningOfTheReportingPeriod', valueNumeric: '100' },
        { inputKey: 'NumberOfEmployeesAtTheEndOfTheReportingPeriod', valueNumeric: '80' },
      ]);
      const rate = field(await readStep(reportId, 'B8'), 'EmployeeTurnoverRate');
      // 12 ÷ ((100 + 80) ÷ 2)
      expect(Number(rate?.valueNumeric)).toBeCloseTo(0.13333333, 6);
      expect(rate?.origin).toBe('calculated');
    });

    it('clears a derived figure when its operands stop being complete', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        { elementKey: ACCIDENTS, valueNumeric: '3', state: DISCLOSURE_STATE.OK },
      ]);
      expect(field(await readStep(reportId, 'B9'), ACCIDENT_RATE)?.valueNumeric).not.toBeNull();
      // The headcount is emptied. A stale rate carrying `origin = calculated` would say the system
      // stands behind an answer it can no longer produce.
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: null, state: DISCLOSURE_STATE.MISSING },
      ]);
      const cleared = field(await readStep(reportId, 'B9'), ACCIDENT_RATE);
      expect(cleared?.valueNumeric).toBeNull();
      expect(cleared?.state).toBe(DISCLOSURE_STATE.MISSING);
    });

    it('refuses a typed rate — derived rather than typed is a rule, not a screen state (FR-29)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
        .send({ values: [{ elementKey: ACCIDENT_RATE, valueNumeric: '99', state: DISCLOSURE_STATE.OK }] })
        .expect(400);
    });

    it('refuses an input no registered derivation reads', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await putInputs(reportId, [{ inputKey: 'HoursSpentReadingTheTaxonomy', valueNumeric: '9000' }], 400);
    });

    it('records an answered zero as a nil return, and a derived zero too (FR-30)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        // *No fatalities* is the disclosure a reader most needs to tell from an unfilled field.
        { elementKey: FATALITIES, valueNumeric: '0', state: DISCLOSURE_STATE.OK },
        { elementKey: ACCIDENTS, valueNumeric: '0', state: DISCLOSURE_STATE.OK },
      ]);
      const step = await readStep(reportId, 'B9');
      expect(field(step, FATALITIES)?.state).toBe(DISCLOSURE_STATE.NIL_RETURN);
      // And the rate computed from them: zero accidents is a rate of zero, which is an answer.
      const rate = field(step, ACCIDENT_RATE);
      expect(Number(rate?.valueNumeric)).toBe(0);
      expect(rate?.state).toBe(DISCLOSURE_STATE.NIL_RETURN);
    });

    it('stops being a nil return when the zero is edited up (FR-30, both directions)', async () => {
      const reportId = await createReport(await openPeriod(2026));
      await put(reportId, [{ elementKey: FATALITIES, valueNumeric: '0', state: DISCLOSURE_STATE.OK }]);
      expect(field(await readStep(reportId, 'B9'), FATALITIES)?.state).toBe(DISCLOSURE_STATE.NIL_RETURN);
      // The browser sends `ok`; so would a client that never learned about nil returns. The state is
      // the value's, not the caller's (P-4).
      await put(reportId, [{ elementKey: FATALITIES, valueNumeric: '2', state: DISCLOSURE_STATE.OK }]);
      expect(field(await readStep(reportId, 'B9'), FATALITIES)?.state).toBe(DISCLOSURE_STATE.OK);
    });
  });

});

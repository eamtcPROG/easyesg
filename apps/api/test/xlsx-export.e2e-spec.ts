import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPart } from '@easyesg/xlsx-patch';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { DIGITAL_TEMPLATE_REGISTRY, type DigitalTemplateRegistry } from '../src/contracts/digital-template-registry.port';
import { XlsxReportWorkbookWriter } from '../src/infrastructure/adapters/workbook/xlsx-report-workbook.writer';
import { EntityIdentifiersRepository } from '../src/infrastructure/persistence/core/entity-identifiers.repository';
import { ExportArtifactStoreRepository } from '../src/infrastructure/persistence/core/export-artifact-store.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { OMITTED_DISCLOSURES_ELEMENT } from '../src/modules/core/disclosure/models/omission.model';
import { EXPORT_RETRY, EXPORT_XLSX_REQUESTED } from '../src/modules/core/export/constants/export.constants';
import { XlsxExportRequestedHandler } from '../src/modules/core/export/consumers/xlsx-export-requested.handler';
import { ComposeReportWorkbook } from '../src/modules/core/export/use-cases/compose-report-workbook.use-case';
import { ProduceXlsxExport } from '../src/modules/core/export/use-cases/produce-xlsx-export.use-case';
import { ReadReportContents } from '../src/modules/core/export/use-cases/read-report-contents.use-case';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { type CalcReading, cellOf, openInCalc } from './support/calc-file';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { exportStorage, inertNotifications, requestExport, storageReader } from './support/export-files';
import { cleanupSignedInAccounts, REGISTERED_NAME, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import { structureOf } from './support/workbook-structure';

const ORG = '01930000-0000-7000-8000-0000000000e6';
const EMAILS = { admin: 'oa@xlsx-export.test', editor: 'rc@xlsx-export.test' };
const CHISINAU = 'Europe/Chisinau';
const IDNO = '1003600005148';
const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
const OVERRIDE_REASON = 'The supplier reissued the fuel statements';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const template = (version: string, file: string) => new Uint8Array(readFileSync(resolve(process.cwd(), '../../config/efrag', version, file)));

/**
 * UC-43's file, end to end (task 46; FR-50, FR-53, NFR-20, NFR-22, NFR-70): an export requested as task 47.4's route
 * will request it, its job run as the worker wires it, the stored file opened in the test stack's LibreOffice Calc with
 * Calc's own defaults — NFR-20's automated gate (46.2) — and read back as a reader of the file sees it.
 *
 * **Two reports, two templates**: FY2026 pins EFRAG's `1.3.0`, whose notes are footnotes on its Footnotes sheet, and
 * FY2025 pins `1.2.0`, which has none, so its notes are cell notes (§12.5.6's task-46 rows (2), (9)).
 */
describe('the Excel export (task 46)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let appRole: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  const files = storageReader();
  let may: { reportId: string; exportId: string; file: Uint8Array; calc: CalcReading };
  let russian: { exportId: string; file: Uint8Array; calc: CalcReading };
  let february: { exportId: string; file: Uint8Array; calc: CalcReading };
  let templateRoundTrip: CalcReading;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;

  const handler = () =>
    new XlsxExportRequestedHandler(
      new ProduceXlsxExport(
        new WorkerTenantWork(worker),
        new ExportArtifactStoreRepository(),
        new ComposeReportWorkbook(app.get(ReadReportContents), new EntityIdentifiersRepository()),
        app.get<DigitalTemplateRegistry>(DIGITAL_TEMPLATE_REGISTRY),
        new XlsxReportWorkbookWriter(),
        exportStorage(),
        inertNotifications(),
        () => new Date(),
      ),
    );

  /** A request as task 47.4's route will write it, the editor bound as the one asking. */
  const requested = (reportId: string, locale: string, format = 'xlsx'): Promise<string> =>
    requestExport({ appRole, organizationId: ORG, accountId: editor.accountId, reportId, format, locale });

  const record = (exportId: string) =>
    asOrganization(owner, ORG, async (run) => {
      const rows = (await run(`SELECT * FROM core.export_artifact WHERE id = $1`, [exportId])) as Record<string, unknown>[];
      return rows[0];
    });

  const produced = async (reportId: string, locale: string) => {
    const exportId = await requested(reportId, locale);
    await handler().handle(
      { organizationId: ORG, exportId },
      { jobId: exportId, jobName: EXPORT_XLSX_REQUESTED, attempt: 1, attempts: EXPORT_RETRY.attempts },
    );
    const settled = await record(exportId);
    if (typeof settled.object_key !== 'string') throw new Error(`Export ${exportId} settled ${String(settled.status)}: ${String(settled.failure)}`);
    const file = await files.file(settled.object_key);
    return { exportId, file, calc: await openInCalc(file) };
  };

  /** The run tables carry no `DELETE` policy, so `FORCE` is lifted for the cleanup, inside one transaction. */
  const removeFixtures = async (): Promise<void> => {
    await asOrganization(owner, ORG, async (run) => {
      for (const table of ['core.calc_input', 'core.calc_result', 'core.calc_run']) {
        await run(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
        await run(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
        await run(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      }
      await run(`DELETE FROM core.organization WHERE id = $1`, [ORG]);
    });
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  const openPeriodReport = async (entityId: string, fiscalYear: number): Promise<string> => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear,
      periodStart: { date: `${fiscalYear}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${fiscalYear}-12-31`, timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    return objectOf<{ id: string }>(report.body).id;
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-xlsx-export-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-xlsx-export-worker');
    appRole = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-xlsx-export-app');
    await removeFixtures();
    await files.removeOrganization(ORG);
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Registrului SRL', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [account.accountId, ORG, role]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Brutăria Registrului', legalForm: 'srl', naceCodes: ['10.71'], idno: IDNO,
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const entityId = objectOf<{ id: string }>(entity.body).id;

    // FY2026, pinned to EFRAG's 1.3.0: a figure of each kind, a gap, a nil return, an omitted module, a computed figure
    // the platform derives alike and one it does not, two units for B4's one unit cell, and text that opens like a formula.
    const reportId = await openPeriodReport(entityId, 2026);
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [
        { elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK },
        { elementKey: 'NumberOfEmployees', valueNumeric: '50', state: DISCLOSURE_STATE.OK },
        { elementKey: 'TotalEnergyConsumption', state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: 'Shared meter with the landlord' },
        { elementKey: OMITTED_DISCLOSURES_ELEMENT, valueText: 'vsme:B5-BiodiversityMember', state: DISCLOSURE_STATE.OK },
        { elementKey: 'NumberOfPermanentContractEmployees', valueNumeric: '45', state: DISCLOSURE_STATE.OK },
        // The template computes temporary contracts as total − permanent, which gives 5: the undertaking's 6 is noted.
        { elementKey: 'NumberOfTemporaryContractEmployees', valueNumeric: '6', state: DISCLOSURE_STATE.OK },
        { elementKey: 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod', valueNumeric: '2', state: DISCLOSURE_STATE.OK },
        { elementKey: 'NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth', valueNumeric: '0', state: DISCLOSURE_STATE.OK },
        { elementKey: 'AmountOfEmissionToAir', dimensionKey: 'AmmoniaNH3Member', valueNumeric: '1.25', unitCode: 't', state: DISCLOSURE_STATE.OK },
        { elementKey: 'AmountOfEmissionToWater', dimensionKey: 'AmmoniaNH3Member', valueNumeric: '300', unitCode: 'kg', state: DISCLOSURE_STATE.OK },
        { elementKey: 'DescriptionOfSustainabilityRelatedCertificationsOrLabels', valueText: '=HYPERLINK("http://x") we hold none', state: DISCLOSURE_STATE.OK },
      ],
    }).expect(200);
    await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization).send({
      values: [
        { inputKey: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', valueNumeric: '3' },
        { inputKey: 'NumberOfEmployeesAtTheBeginningOfTheReportingPeriod', valueNumeric: '40' },
        { inputKey: 'NumberOfEmployeesAtTheEndOfTheReportingPeriod', valueNumeric: '20' },
      ],
    }).expect(204);
    await http().put(`/api/v1/reports/${reportId}/calculator/sources/${randomUUID()}`).set(editor.authorization)
      .send({ siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Oven and boiler', quantity: '500', unitCode: 'm3' }).expect(200);
    await http().post(`/api/v1/reports/${reportId}/calculator/runs`).set(editor.authorization).expect(201);
    await http().put(`/api/v1/reports/${reportId}/calculator/figures/${SCOPE_1}/override`).set(editor.authorization)
      .send({ valueNumeric: '1.75', explanation: OVERRIDE_REASON }).expect(204);

    // FY2025, pinned to EFRAG's 1.2.0, which has no Footnotes sheet.
    const earlierId = await openPeriodReport(entityId, 2025);
    await http().put(`/api/v1/reports/${earlierId}/values`).set(editor.authorization).send({
      values: [
        { elementKey: 'Turnover', valueNumeric: '990000', state: DISCLOSURE_STATE.OK },
        { elementKey: 'Assets', state: DISCLOSURE_STATE.NOT_AVAILABLE, notAvailableReason: 'Audit pending' },
      ],
    }).expect(200);

    may = { reportId, ...(await produced(reportId, 'en')) };
    russian = await produced(reportId, 'ru');
    february = await produced(earlierId, 'en');
    templateRoundTrip = await openInCalc(template('1.3.0', 'VSME-Digital-Template-1.3.0.xlsx'));
  }, 600_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await files.removeOrganization(ORG);
    files.client.destroy();
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker, appRole]) if (source?.isInitialized) await source.destroy();
  });

  it('writes the template the report pins, stores it as an Excel file and settles its record (46.1; FR-53)', async () => {
    const settled = await record(may.exportId);
    expect(settled).toMatchObject({
      status: 'completed',
      format: 'xlsx',
      locale: 'en',
      template_version: '1.3.0',
      taxonomy_version: '2026-05-01',
      object_key: `organizations/${ORG}/exports/${may.exportId}.xlsx`,
      byte_size: String(may.file.byteLength),
      sha256: createHash('sha256').update(may.file).digest('hex'),
    });
    expect(await record(february.exportId)).toMatchObject({ status: 'completed', template_version: '1.2.0', taxonomy_version: '2026-02-01' });
    expect(await files.contentType(String(settled.object_key))).toBe(XLSX);
  });

  it('opens in LibreOffice Calc with its defaults, its named ranges, dropdowns and formulas intact (46.2; NFR-20, FR-50 AC-2, AC-4)', () => {
    // Compared with the template's own round trip through Calc, so whatever Calc changes in re-saving any workbook
    // cancels out and a difference is the export's.
    for (const { calc } of [may, russian]) expect(structureOf(calc.roundTrip)).toEqual(structureOf(templateRoundTrip.roundTrip));
  });

  it('shows the formulas’ results to a reader’s Calc — B8’s turnover rate and B9’s accident rate, from the inputs written (46.2; 182/32)', () => {
    expect(cellOf(may.calc, 'Social Disclosures', 'D134')).toBe('3');
    expect(cellOf(may.calc, 'Social Disclosures', 'D137')).toBe('10%');
    expect(cellOf(may.calc, 'Social Disclosures', 'D143')).toBe('4');
    // Temporary contracts are the template's own arithmetic, 50 − 45, beside the undertaking's 6 in a footnote.
    expect(cellOf(may.calc, 'Social Disclosures', 'D11')).toBe('5');
  });

  it('sets the language cell to EFRAG’s English whatever the export’s language, and leaves the Translations sheet as it was (182/31; FR-50 AC-11)', () => {
    expect(cellOf(russian.calc, 'Language Selection', 'G7')).toBe('English - Official [en]');
    const translations = 'xl/worksheets/sheet13.xml';
    expect(readPart(russian.file, translations)).toBe(readPart(template('1.3.0', 'VSME-Digital-Template-1.3.0.xlsx'), translations));
  });

  it('writes none of the prior period’s values, the template having no cell for one (182/33; FR-50 AC-13)', () => {
    // FY2025 is FY2026's prior period, its turnover 990000: the figure is nowhere in FY2026's file.
    expect(cellOf(may.calc, 'General Information', 'E283')).toBe('1250000');
    expect([...may.calc.sheets.values()].flat(2).filter((shown) => shown.includes('990000'))).toEqual([]);
  });

  it('writes the entity, its IDNO with the scheme blank, the currency and the period (FR-50 AC-5; task-46 row (5))', () => {
    const general = (cell: string) => cellOf(may.calc, 'General Information', cell);
    expect([general('D3'), general('D4'), general('E4'), general('D5')]).toEqual(['Brutăria Registrului', '', IDNO, 'MDL']);
    expect([general('D9'), general('D13')]).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('writes a nil return as a stated zero, an omitted module through the ToC — which fills B1’s list — and a formula-like text as text (FR-50 AC-7, AC-8, AC-9)', () => {
    expect(cellOf(may.calc, 'Social Disclosures', 'D144')).toBe('0');
    expect(cellOf(may.calc, 'General Information', 'E126')).toBe('B5 - Biodiversity');
    expect(cellOf(may.calc, 'General Information', 'E397')).toBe('=HYPERLINK("http://x") we hold none');
  });

  it('writes B4’s figures in the one unit its cell offers, converting the tonnes exactly (task-46 row (6))', () => {
    const environmental = (cell: string) => cellOf(may.calc, 'Environmental Disclosures', cell);
    expect([environmental('C78'), environmental('D80'), environmental('G80'), environmental('J80')]).toEqual([
      'kilograms (kg)',
      'Ammonia (NH3)',
      '1250',
      '300',
    ]);
  });

  it('footnotes the company estimate, the gap, the factor set and the undertaking’s own figures on 1.3.0’s Footnotes sheet (46.5; FR-44 AC-9, FR-50 AC-6)', () => {
    const footnotes = may.calc.sheets.get('Footnotes') ?? [];
    const texts = footnotes.map((row) => row[1] ?? '').join('\n');
    // The estimate and the factor set are notes on one figure, so one footnote — and its figures read as the PDF's
    // note reads them (`pdf-export.e2e-spec.ts`), one rule for both files (NFR-18).
    expect(texts).toContain(
      `Company estimate: 1.75 t CO₂e is the undertaking's figure, given in place of 0.97 t CO₂e calculated by the platform. ` +
        `Reason given: ${OVERRIDE_REASON} Replaced by ${REGISTERED_NAME.givenName} ${REGISTERED_NAME.familyName}. ` +
        'Calculated by the platform with the emission factor set 2026.1.',
    );
    expect(texts).toContain('Not available: the undertaking could not obtain this information for the reporting period. Reason given: Shared meter with the landlord');
    expect(texts).toContain('The undertaking reports 6 for this figure.');
    expect(texts).toContain('Reported as 1.25 t; written here in kg');
    // Each footnote names the cell it explains from EFRAG's own list, which the template's validation admits.
    expect(footnotes.map((row) => row[3] ?? '')).toEqual(expect.arrayContaining(['Total energy consumption', 'Gross Scope 1 greenhouse gas emissions']));
    // And the template's checks still pass on the figure the estimate replaced: its status cell is not an error.
    expect(cellOf(may.calc, 'Environmental Disclosures', 'L22')).not.toMatch(/ERROR|INCONSISTENCY/u);
  });

  it('says in the Russian export that its notes are the platform’s wording with no EFRAG standing, on B1’s basis (46.3; FR-50 AC-10)', () => {
    const footnotes = russian.calc.sheets.get('Footnotes') ?? [];
    const statement = footnotes.find((row) => (row[1] ?? '').startsWith('Примечания в этом файле'));
    expect(statement?.[3]).toBe('Basis for preparation (Basic Module Only or Basic & Comprehensive Module)');
    const english = (may.calc.sheets.get('Footnotes') ?? []).map((row) => row[1] ?? '').join('\n');
    expect(english).not.toContain('carry no EFRAG standing');
  });

  it('puts 1.2.0’s notes on the figures’ own cells, and Calc keeps them (task-46 row (9))', () => {
    expect(cellOf(february.calc, 'General Information', 'E281')).toBe('990000');
    const notes = readPart(february.calc.roundTrip, 'xl/comments1.xml') ?? readPart(february.calc.roundTrip, 'xl/comments3.xml') ?? '';
    const all = [1, 2, 3, 4, 5, 6].map((n) => readPart(february.calc.roundTrip, `xl/comments${n}.xml`) ?? '').join('');
    expect(all || notes).toContain('Reason given: Audit pending');
  });

  it('names the platform as the file’s writer and carries its language, moment and person (task-46 rows (4), (7); NFR-22)', async () => {
    expect(readPart(may.file, 'docProps/app.xml')).toContain('<Application>EasyESG</Application>');
    const core = readPart(russian.file, 'docProps/core.xml') ?? '';
    const settled = await record(russian.exportId);
    expect(core).toContain('<dc:language>ru</dc:language>');
    expect(core).toContain(`<dcterms:modified xsi:type="dcterms:W3CDTF">${(settled.generated_at as Date).toISOString().replace(/\.\d{3}Z$/u, 'Z')}</dcterms:modified>`);
    expect(core).toContain(`<cp:lastModifiedBy>${REGISTERED_NAME.givenName} ${REGISTERED_NAME.familyName}</cp:lastModifiedBy>`);
  });

  it('refuses an Excel job for a PDF export, recording the failure on the last attempt', async () => {
    const exportId = await requested(may.reportId, 'en', 'pdf');
    await expect(
      handler().handle({ organizationId: ORG, exportId }, { jobId: exportId, jobName: EXPORT_XLSX_REQUESTED, attempt: 3, attempts: 3 }),
    ).rejects.toThrow('asks for a pdf file, not xlsx');
    expect(await record(exportId)).toMatchObject({ status: 'failed' });
  });
});


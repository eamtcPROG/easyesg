import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { DIGITAL_TEMPLATE_REGISTRY, type DigitalTemplateRegistry } from '../src/contracts/digital-template-registry.port';
import { REPORT_DOCUMENT_RENDERER, type ReportDocumentRenderer } from '../src/contracts/report-document.port';
import { HttpPdfRenderer } from '../src/infrastructure/adapters/renderer/http-pdf-renderer';
import { XlsxReportWorkbookWriter } from '../src/infrastructure/adapters/workbook/xlsx-report-workbook.writer';
import { EntityIdentifiersRepository } from '../src/infrastructure/persistence/core/entity-identifiers.repository';
import { ExportArtifactStoreRepository } from '../src/infrastructure/persistence/core/export-artifact-store.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { EXPORT_FORMAT, EXPORT_RETRY } from '../src/modules/core/export/constants/export.constants';
import { ComposeReportDocument } from '../src/modules/core/export/use-cases/compose-report-document.use-case';
import { ComposeReportWorkbook } from '../src/modules/core/export/use-cases/compose-report-workbook.use-case';
import { ProducePdfExport } from '../src/modules/core/export/use-cases/produce-pdf-export.use-case';
import { ProduceXlsxExport } from '../src/modules/core/export/use-cases/produce-xlsx-export.use-case';
import { ReadReportContents } from '../src/modules/core/export/use-cases/read-report-contents.use-case';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { cellOf, openInCalc } from './support/calc-file';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { exportStorage, inertNotifications, requestExport, storageReader } from './support/export-files';
import { pdfText, squash } from './support/pdf-file';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import { computedValueOf } from './support/workbook-structure';

const CORPUS = resolve(process.cwd(), '../../config/golden-reports');

/** One golden report: its inputs as the api writes them (`report.json`) and what each file must say (`expected.json`). */
interface GoldenReport {
  readonly entity: Record<string, unknown>;
  readonly period: { readonly fiscalYear: number; readonly start: string; readonly end: string; readonly timezone: string };
  readonly values: readonly Record<string, unknown>[];
  readonly derivationInputs: readonly Record<string, unknown>[];
  readonly calculator: { readonly sources: readonly Record<string, unknown>[] };
  readonly exports: readonly string[];
}
interface GoldenExpectation {
  readonly pins: { readonly templateVersion: string; readonly taxonomyVersion: string };
  /** Per language: phrases the PDF must say, compared with every space removed and in lower case. */
  readonly pdf: Readonly<Record<string, readonly string[]>>;
  /** Per language: `Sheet!A1` → the value LibreOffice Calc shows there once the export is open. */
  readonly xlsx: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Figures the template computes by formula and the platform derives, each held equal to the other (182/32). */
  readonly computed: readonly { readonly element: string; readonly cell: string }[];
}

const corpus = readdirSync(CORPUS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    report: JSON.parse(readFileSync(join(CORPUS, entry.name, 'report.json'), 'utf8')) as GoldenReport,
    expected: JSON.parse(readFileSync(join(CORPUS, entry.name, 'expected.json'), 'utf8')) as GoldenExpectation,
  }));

/**
 * The golden-report corpus (task 46.4; NFR-18, NFR-19; §12.5.6's task-46 row (8)): each report in
 * `config/golden-reports/` written through the api as a reporter would, exported to PDF and to the EFRAG template in
 * each of its languages, the Excel file opened in LibreOffice Calc with its defaults — and every file diffed against the
 * expectation stored beside the report. **The suite NFR-19's nightly replay runs**: a change that moves what either
 * file says about a filed report fails here until the expectation is changed with it, in the diff a reviewer reads.
 *
 * **182/32's proof is the `computed` list**: for each figure the platform derives from the very inputs the export
 * writes — B3's location-based total and intensity, B8's turnover rate, B9's accident rate, B10's pay gap and bargaining
 * coverage (task-46 row (3)) — the template computes it again by its own formula, so the value Calc computes in the file
 * must equal the figure the platform stored, to the precision of a double. A figure the standard does not ask of the
 * undertaking is neither printed nor computed: its inputs are not written (FR-28), which the expectation's empty cells
 * hold — `bakery-2026`'s pay gap, at 50 employees.
 *
 * **The expectation's cells include the template's own checks** — the ToC's status per section, which reads every
 * section `OK` the report answers and B1's identifier line `MISSING VALUE`, the template having no scheme for an IDNO
 * (task-46 row (5)). A status that moves is the template disagreeing with what the export wrote.
 */
describe.each(corpus)('the golden report $name (task 46.4)', ({ name, report, expected }) => {
  const ORG = randomUUID();
  const EMAILS = { admin: `oa@golden-${name}.test`, editor: `rc@golden-${name}.test` };
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let appRole: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let reportId: string;
  const files = storageReader();
  const pdfs = new Map<string, string>();
  const workbooks = new Map<string, Awaited<ReturnType<typeof openInCalc>>>();
  const records: Record<string, unknown>[] = [];

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const context = (exportId: string) => ({ jobId: exportId, jobName: 'golden', attempt: 1, attempts: EXPORT_RETRY.attempts });

  const produce = async (format: string, locale: string): Promise<Uint8Array> => {
    const exportId = await requestExport({ appRole, organizationId: ORG, accountId: editor.accountId, reportId, format, locale });
    const tenantWork = new WorkerTenantWork(worker);
    const store = new ExportArtifactStoreRepository();
    if (format === EXPORT_FORMAT.PDF) {
      await new ProducePdfExport(
        tenantWork,
        store,
        app.get(ComposeReportDocument),
        app.get<ReportDocumentRenderer>(REPORT_DOCUMENT_RENDERER),
        new HttpPdfRenderer({ url: process.env.RENDERER_URL ?? '', timeoutMs: 180_000 }),
        exportStorage(),
        inertNotifications(),
        () => new Date(),
      ).execute({ organizationId: ORG, exportId, ...context(exportId) });
    } else {
      await new ProduceXlsxExport(
        tenantWork,
        store,
        new ComposeReportWorkbook(app.get(ReadReportContents), new EntityIdentifiersRepository()),
        app.get<DigitalTemplateRegistry>(DIGITAL_TEMPLATE_REGISTRY),
        new XlsxReportWorkbookWriter(),
        exportStorage(),
        inertNotifications(),
        () => new Date(),
      ).execute({ organizationId: ORG, exportId, ...context(exportId) });
    }
    const settled = await asOrganization(owner, ORG, async (run) => ((await run(`SELECT * FROM core.export_artifact WHERE id = $1`, [exportId])) as Record<string, unknown>[])[0]);
    records.push(settled);
    if (typeof settled.object_key !== 'string') throw new Error(`${name} ${format} ${locale} settled ${String(settled.status)}: ${String(settled.failure)}`);
    return files.file(settled.object_key);
  };

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

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', `easyesg-golden-${name}-owner`);
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', `easyesg-golden-${name}-worker`);
    appRole = await connectAs('DB_USER', 'DB_PASSWORD', `easyesg-golden-${name}-app`);
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [ORG, `${String(report.entity.name)} SRL`]));
    admin = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server: app.getHttpServer(), worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [account.accountId, ORG, role]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send(report.entity).expect(201);
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: objectOf<{ id: string }>(entity.body).id,
      fiscalYear: report.period.fiscalYear,
      periodStart: { date: report.period.start, timezone: report.period.timezone },
      periodEnd: { date: report.period.end, timezone: report.period.timezone },
    }).expect(201);
    const created = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    reportId = objectOf<{ id: string }>(created.body).id;

    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({ values: report.values }).expect(200);
    await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization).send({ values: report.derivationInputs }).expect(204);
    for (const source of report.calculator.sources) {
      await http().put(`/api/v1/reports/${reportId}/calculator/sources/${randomUUID()}`).set(editor.authorization).send(source).expect(200);
    }
    if (report.calculator.sources.length > 0) await http().post(`/api/v1/reports/${reportId}/calculator/runs`).set(editor.authorization).expect(201);

    for (const locale of report.exports) {
      pdfs.set(locale, squash((await pdfText(Buffer.from(await produce(EXPORT_FORMAT.PDF, locale)))).pages.join(' ')).toLowerCase());
      workbooks.set(locale, await openInCalc(await produce(EXPORT_FORMAT.XLSX, locale)));
    }
  }, 900_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await files.removeOrganization(ORG);
    files.client.destroy();
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker, appRole]) if (source?.isInitialized) await source.destroy();
  });

  it('is exported against the template and the taxonomy it pins, in every format and language', () => {
    expect(records.map((settled) => [settled.template_version, settled.taxonomy_version])).toEqual(
      records.map(() => [expected.pins.templateVersion, expected.pins.taxonomyVersion]),
    );
  });

  it('says in each PDF what its expectation says', () => {
    for (const [locale, phrases] of Object.entries(expected.pdf)) {
      const missing = phrases.filter((phrase) => !(pdfs.get(locale) ?? '').includes(squash(phrase).toLowerCase()));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  it('shows in each workbook, open in LibreOffice Calc, what its expectation says (NFR-18)', () => {
    for (const [locale, cells] of Object.entries(expected.xlsx)) {
      const calc = workbooks.get(locale);
      if (calc === undefined) throw new Error(`no ${locale} workbook was produced`);
      const shown = Object.fromEntries(Object.keys(cells).map((at) => {
        const [sheet, cell] = at.split('!');
        return [at, cellOf(calc, sheet, cell)];
      }));
      expect({ locale, shown }).toEqual({ locale, shown: cells });
    }
  });

  it('computes, by the template’s own formula, each figure the platform derives from the inputs it writes (182/32)', async () => {
    const stored = await asOrganization(owner, ORG, async (run) =>
      (await run(`SELECT element_key, value_numeric::text AS value FROM core.report_disclosure_value WHERE report_id = $1`, [reportId])) as {
        element_key: string;
        value: string | null;
      }[]);
    for (const { element, cell } of expected.computed) {
      const [sheet, address] = cell.split('!');
      const figure = stored.find((row) => row.element_key === element)?.value ?? null;
      for (const [, calc] of workbooks) {
        const computed = computedValueOf(calc.roundTrip, sheet, address);
        expect({ element, figure: figure !== null, computed: computed !== null }).toEqual({ element, figure: true, computed: true });
        // Equal to a double's precision: Calc computes in doubles, the platform stores the decimal it derived.
        expect(Math.abs(Number(computed) - Number(figure))).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(Number(figure))));
      }
    }
  });
});

import { createHash, randomUUID } from 'node:crypto';
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PDF_RENDERER } from '../src/contracts/pdf-renderer.port';
import { REPORT_DOCUMENT_RENDERER, type ReportDocumentRenderer } from '../src/contracts/report-document.port';
import { S3ObjectStorage } from '../src/infrastructure/adapters/object-storage/s3-object-storage';
import { HttpPdfRenderer } from '../src/infrastructure/adapters/renderer/http-pdf-renderer';
import { ExportArtifactStoreRepository } from '../src/infrastructure/persistence/core/export-artifact-store.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { OMITTED_DISCLOSURES_ELEMENT } from '../src/modules/core/disclosure/models/omission.model';
import { EXPORT_PDF_REQUESTED, EXPORT_RETRY } from '../src/modules/core/export/constants/export.constants';
import { PdfExportRequestedHandler } from '../src/modules/core/export/consumers/pdf-export-requested.handler';
import { ComposeReportDocument } from '../src/modules/core/export/use-cases/compose-report-document.use-case';
import { ProducePdfExport } from '../src/modules/core/export/use-cases/produce-pdf-export.use-case';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { inertNotifications } from './support/export-files';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { conformance, pdfText, squash } from './support/pdf-file';
import { freezeNextBrowser, liveBrowserProcesses } from './support/renderer-container';
import {
  cleanupSignedInAccounts,
  REGISTERED_NAME,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000e4';
const EMAILS = { admin: 'oa@pdf-export.test', editor: 'rc@pdf-export.test' };
const CHISINAU = 'Europe/Chisinau';
const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
const OVERRIDE_REASON = 'The supplier reissued the fuel statements';

interface ExportRecord {
  status: string;
  locale: string;
  template_version: string;
  taxonomy_version: string;
  requested_by: string;
  generated_at: Date | null;
  object_key: string | null;
  byte_size: string | null;
  sha256: string | null;
  failure: string | null;
}

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; the test stack's env files supply it.`);
  return value;
};

/**
 * UC-42's file, end to end (task 44; FR-49, FR-53, NFR-22, NFR-82, T-13): an export requested as task 47.4's route will
 * request it, and its job run as the worker wires it — the composition the preview uses, the test stack's renderer
 * (Chromium and the finisher), its object storage, and veraPDF over every file.
 *
 * **The job runs here, in an HTTP-mode process, by hand**, as every worker handler's suite does: the mode is read at
 * module-definition time, so the worker's graph cannot be booted beside the HTTP one. Its parts are the worker's own —
 * `WorkerTenantWork` over the worker's role, the store, both adapters — and the composition is the one provider the two
 * modes share. That the worker routes the job and gives it its retry is `entrypoint-boot.e2e-spec.ts`'s, in worker mode.
 */
describe('the PDF export (task 44)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let appRole: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let reportId: string;
  let storage: S3Client;
  let russian: { exportId: string; pdf: Buffer };
  let english: { exportId: string; pdf: Buffer };

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;

  /** The worker's handler, its renderer client at `rendererUrl` — the test stack's own unless a case says otherwise. */
  const handlerAt = (rendererUrl = required('RENDERER_URL')) =>
    new PdfExportRequestedHandler(
      new ProducePdfExport(
        new WorkerTenantWork(worker),
        new ExportArtifactStoreRepository(),
        app.get(ComposeReportDocument),
        app.get<ReportDocumentRenderer>(REPORT_DOCUMENT_RENDERER),
        new HttpPdfRenderer({ url: rendererUrl, timeoutMs: 180_000 }),
        new S3ObjectStorage({
          endpoint: required('OBJECT_STORAGE_ENDPOINT'),
          region: process.env.OBJECT_STORAGE_REGION ?? 'fr-par',
          bucket: process.env.OBJECT_STORAGE_BUCKET ?? 'esg-exports',
          accessKeyId: required('OBJECT_STORAGE_ACCESS_KEY_ID'),
          secretAccessKey: required('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
        }),
        inertNotifications(),
        () => new Date(),
      ),
    );

  /** One attempt of the job, as the consumer hands it over. */
  const attempt = (exportId: string, number: number, handler = handlerAt()) =>
    handler.handle(
      { organizationId: ORG, exportId },
      { jobId: exportId, jobName: EXPORT_PDF_REQUESTED, attempt: number, attempts: EXPORT_RETRY.attempts },
    );

  /** A request as task 47.4's route will write it: as the application, the editor bound as the one asking. */
  const requestExport = async (locale: string): Promise<string> => {
    const exportId = randomUUID();
    const runner = appRole.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SELECT set_config('app.current_org', $1, true), set_config('app.current_user', $2, true)`, [
        ORG,
        editor.accountId,
      ]);
      await runner.query(
        `INSERT INTO core.export_artifact (id, organization_id, report_id, format, locale) VALUES ($1, $2, $3, 'pdf', $4)`,
        [exportId, ORG, reportId, locale],
      );
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    return exportId;
  };

  const record = async (exportId: string): Promise<ExportRecord> =>
    asOrganization(owner, ORG, async (run) => {
      const rows = (await run(`SELECT * FROM core.export_artifact WHERE id = $1`, [exportId])) as ExportRecord[];
      return rows[0];
    });

  const storedFile = async (key: string): Promise<Buffer> => {
    const object = await storage.send(new GetObjectCommand({ Bucket: 'esg-exports', Key: key }));
    return Buffer.from(await (object.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
  };

  /**
   * A file's words as one string, spaces gone and in lower case: PDF.js spaces letter-spaced labels apart, and the
   * stylesheet sets the marks and the labels in capitals — their words are the catalogue's either way.
   */
  const wordsOf = async (pdf: Buffer): Promise<string> => squash((await pdfText(pdf)).pages.join(' ')).toLowerCase();
  const phrase = (text: string): string => squash(text).toLowerCase();

  /** An export requested and produced in one attempt, answering the file as it was stored. */
  const produced = async (locale: string): Promise<{ exportId: string; pdf: Buffer }> => {
    const exportId = await requestExport(locale);
    await attempt(exportId, 1);
    const settled = await record(exportId);
    if (settled.object_key === null) throw new Error(`Export ${exportId} settled ${settled.status}: ${settled.failure}`);
    return { exportId, pdf: await storedFile(settled.object_key) };
  };

  const removeStoredFiles = async (): Promise<void> => {
    const listed = await storage.send(
      new ListObjectsV2Command({ Bucket: 'esg-exports', Prefix: `organizations/${ORG}/` }),
    );
    const keys = (listed.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
    if (keys.length > 0) await storage.send(new DeleteObjectsCommand({ Bucket: 'esg-exports', Delete: { Objects: keys } }));
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

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    // `abortOnError: false` so the last case's refused resolution throws, rather than Nest ending the process.
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-pdf-export-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-pdf-export-worker');
    appRole = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-pdf-export-app');
    storage = new S3Client({
      endpoint: required('OBJECT_STORAGE_ENDPOINT'),
      region: process.env.OBJECT_STORAGE_REGION ?? 'fr-par',
      credentials: {
        accessKeyId: required('OBJECT_STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: required('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    await removeFixtures();
    await removeStoredFiles();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Exportului SRL', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [
          account.accountId,
          ORG,
          role,
        ]));
    }

    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Brutăria Exportului', legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: objectOf<{ id: string }>(entity.body).id,
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    reportId = objectOf<{ id: string }>(report.body).id;

    // A figure, a gap with its reason, and a nil return — the three a reader must tell apart (UX-119).
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization).send({
      values: [
        { elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK },
        {
          elementKey: 'TotalEnergyConsumption',
          state: DISCLOSURE_STATE.NOT_AVAILABLE,
          notAvailableReason: 'Shared meter with the landlord',
        },
        // B9 applies once B1 states a workforce, and a written zero on a count is recorded as a nil return (FR-30).
        { elementKey: 'NumberOfEmployees', valueNumeric: '12', state: DISCLOSURE_STATE.OK },
        // A module omitted whole as classified or sensitive information (FR-31), stated rather than left blank.
        { elementKey: OMITTED_DISCLOSURES_ELEMENT, valueText: 'vsme:B5-BiodiversityMember', state: DISCLOSURE_STATE.OK },
        // A reporter's text that opens in markup, which the file must show as the words they typed (NFR-70).
        {
          elementKey: 'DescriptionOfSustainabilityRelatedCertificationsOrLabels',
          valueText: '<script>alert(1)</script> We hold no certification.',
          state: DISCLOSURE_STATE.OK,
        },
        {
          elementKey: 'NumberOfFatalitiesAsAResultOfWorkRelatedInjuriesAndWorkRelatedIllHealth',
          valueNumeric: '0',
          state: DISCLOSURE_STATE.OK,
        },
      ],
    }).expect(200);
    // A calculated Scope 1 figure, then the undertaking's own in its place, with a reason (UC-34; UX-43).
    await http().put(`/api/v1/reports/${reportId}/calculator/sources/${randomUUID()}`).set(editor.authorization)
      .send({ siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Oven and boiler', quantity: '500', unitCode: 'm3' })
      .expect(200);
    await http().post(`/api/v1/reports/${reportId}/calculator/runs`).set(editor.authorization).expect(201);
    await http().put(`/api/v1/reports/${reportId}/calculator/figures/${SCOPE_1}/override`).set(editor.authorization)
      .send({ valueNumeric: '1.75', explanation: OVERRIDE_REASON }).expect(204);

    russian = await produced('ru');
    english = await produced('en');
  }, 300_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    if (storage !== undefined) {
      await removeStoredFiles();
      storage.destroy();
    }
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker, appRole]) if (source?.isInitialized) await source.destroy();
  });

  it('prints the export in its own language on the renderer, stores the file and settles its record (44.2; FR-53)', async () => {
    const settled = await record(russian.exportId);
    expect(settled).toMatchObject({
      status: 'completed',
      locale: 'ru',
      template_version: '1.3.0',
      taxonomy_version: '2026-05-01',
      requested_by: editor.accountId,
      object_key: `organizations/${ORG}/exports/${russian.exportId}.pdf`,
      byte_size: String(russian.pdf.length),
      failure: null,
    });
    // The record's digest is the stored file's, byte for byte.
    expect(settled.sha256).toBe(createHash('sha256').update(russian.pdf).digest('hex'));
    expect(russian.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const { title } = await pdfText(russian.pdf);
    expect(title).toBe('Brutăria Exportului · Отчёт об устойчивом развитии за 2026 год');
  });

  it('is a tagged PDF/A-2a and PDF/UA-1 file, by veraPDF, in both languages (44.3; NFR-82, UX-120)', async () => {
    for (const { pdf } of [russian, english]) {
      expect(await conformance(pdf, '2a')).toEqual({ compliant: true, failed: [] });
      expect(await conformance(pdf, 'ua1')).toEqual({ compliant: true, failed: [] });
    }
  }, 180_000);

  it('marks the undertaking’s figure a company estimate and footnotes what it replaced and why (44.6; UX-43, FR-36)', async () => {
    const text = await wordsOf(english.pdf);
    // The marks are set in capitals by the stylesheet; their words are the catalogue's.
    expect(text).toContain(phrase('1 company estimate'));
    // The figure it replaced is a calculated one, stored with no unit: printed in tonnes CO2e at their two places, the
    // digits EFRAG's template shows the cell at (task-46 row (10)).
    expect(text).toContain(phrase("1.75 is the undertaking's figure, given in place of 0.97 calculated by the platform."));
    expect(text).toContain(phrase(`Reason given: ${OVERRIDE_REASON}`));
    expect(text).toContain(phrase(`Replaced by ${REGISTERED_NAME.givenName} ${REGISTERED_NAME.familyName}.`));
  });

  it('says in the Russian file that its labels are the platform’s translation, and in the English that they are EFRAG’s (44.7; UX-98)', async () => {
    const russianText = await wordsOf(russian.pdf);
    expect(russianText).toContain(phrase('Наименования раскрытий на этом языке — собственный перевод платформы'));
    const englishText = await wordsOf(english.pdf);
    expect(englishText).toContain(phrase("Disclosure labels are EFRAG's official wording in this language"));
    expect(englishText).not.toContain(phrase("the platform's own translation"));
  });

  it('carries NFR-22’s seven facts: entity, period, template and taxonomy, factor set, language, and when it was made', async () => {
    const settled = await record(english.exportId);
    const text = await wordsOf(english.pdf);
    const moment = new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: CHISINAU, timeZoneName: 'short',
    }).format(settled.generated_at ?? undefined);
    for (const fact of [
      'Brutăria Exportului',
      'January 1 – December 31, 2026',
      'VSME Digital Template 1.3.0',
      'VSME taxonomy 2026-05-01',
      // The seeded `md` factor set's label, as the run pinned it.
      'Emission factor set 2026.1',
      'English',
      moment,
    ]) {
      expect(text).toContain(phrase(fact));
    }
    // Who made it, by the name they are shown under, beside when.
    expect(text).toContain(phrase(`Generated by ${REGISTERED_NAME.givenName} ${REGISTERED_NAME.familyName} · ${moment}`));
  });

  it('prints the gap with its reason, the nil return as a stated zero and the omitted module as omitted (UX-119; FR-30, FR-31)', async () => {
    const text = await wordsOf(english.pdf);
    expect(text).toContain(phrase('Not available Reason given: Shared meter with the landlord'));
    expect(text).toContain(phrase('0 Nil return'));
    // The omitted module names itself on its own page and on the cover's count (FR-31 AC-4).
    expect(text).toContain(phrase('B5 Biodiversity The undertaking omits this module as classified or sensitive information.'));
  });

  it('shows a reporter’s text that opens in markup as the words they typed (FR-49 AC-10; NFR-70)', async () => {
    expect(await wordsOf(english.pdf)).toContain(phrase('<script>alert(1)</script> We hold no certification.'));
  });

  it('is settled once: a second job for the export does nothing, and the record takes no further write (AD-6; FR-53 AC-2)', async () => {
    const before = await record(english.exportId);
    await attempt(english.exportId, 1);
    expect(await record(english.exportId)).toEqual(before);

    const worked = await asOrganization(worker, ORG, (run) =>
      run(`UPDATE core.export_artifact SET status = 'failed', failed_at = now(), failure = 'x', object_key = NULL,
             generated_at = NULL, completed_at = NULL, byte_size = NULL, sha256 = NULL WHERE id = $1`, [english.exportId]));
    expect((worked as [unknown[], number])[1]).toBe(0);
    const owned = await asOrganization(owner, ORG, (run) =>
      run(`UPDATE core.export_artifact SET failure = 'x' WHERE id = $1`, [english.exportId]));
    expect((owned as [unknown[], number])[1]).toBe(0);
    expect(await record(english.exportId)).toEqual(before);
  });

  it('records a failure on the last attempt only, and every attempt throws for the queue to retry (§12.5.6’s task-44 row (4))', async () => {
    const exportId = await requestExport('en');
    // A renderer nothing answers at — refused at once, as an unreachable service is.
    const unreachable = handlerAt('http://127.0.0.1:9');
    await expect(attempt(exportId, 1, unreachable)).rejects.toThrow();
    await expect(attempt(exportId, 2, unreachable)).rejects.toThrow();
    expect(await record(exportId)).toMatchObject({ status: 'requested', failure: null });
    await expect(attempt(exportId, 3, unreachable)).rejects.toThrow();
    const failed = await record(exportId);
    expect(failed.status).toBe('failed');
    expect(failed.failure).toEqual(expect.any(String));
    expect(failed.object_key).toBeNull();
  });

  it('kills a hung render at the renderer’s deadline and completes the export on the next attempt (44.4; T-13)', async () => {
    const exportId = await requestExport('en');
    const freezer = await freezeNextBrowser();
    const hung = attempt(exportId, 1);
    expect(await freezer.frozen).toBeGreaterThan(0);
    // The renderer's own deadline kills the frozen browser and answers 504; the attempt fails and nothing is recorded.
    await expect(hung).rejects.toThrow(/504/u);
    expect(await liveBrowserProcesses()).toBe(0);
    expect(await record(exportId)).toMatchObject({ status: 'requested', failure: null });

    // The retry launches a browser of its own, and the export completes.
    await attempt(exportId, 2);
    const settled = await record(exportId);
    expect(settled.status).toBe('completed');
    expect(await conformance(await storedFile(settled.object_key ?? ''), 'ua1')).toEqual({ compliant: true, failed: [] });
  }, 240_000);

  it('renders nothing in the request tier: the HTTP application holds neither the job nor a renderer client (AD-10, DR-10)', () => {
    expect(() => {
      app.get(PDF_RENDERER, { strict: false });
    }).toThrow();
    expect(() => {
      app.get(PdfExportRequestedHandler, { strict: false });
    }).toThrow();
  });
});

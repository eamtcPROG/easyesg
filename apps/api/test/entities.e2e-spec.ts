import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ENTITY_STATUS } from '../src/modules/core/entity/models/reporting-entity.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * S-13's API half, end to end — UC-52, UC-53 and UC-55 (FR-17, FR-18, FR-20), which is task 29.3's
 * stated deliverable: *"CRUD e2e as OA and RC"*.
 *
 * **Both actors, and the asymmetry is the point.** An RC reads and cannot write; an OA does both.
 * That split is D-2 read carefully — master data is OA-*owned*, which is about who maintains it —
 * against UC-19, where the Contributor completes B1 from values that pre-populate from this record.
 * `route-matrix.e2e-spec.ts` proves the gate across every actor; this proves the behaviour behind
 * it, which is a different claim.
 *
 * Cross-tenant isolation is `tenant-isolation.e2e-spec.ts`'s, extended to these tables in the same
 * change.
 */

const ORG = '01930000-0000-7000-8000-0000000000c1';

const EMAILS = {
  admin: 'oa@entities.test',
  editor: 'rc@entities.test',
};

describe('reporting entities (UC-52, UC-53, UC-55)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());

  interface Problem {
    type?: string;
  }
  interface EntityBody {
    id: string;
    name: string;
    naceCodes: string[];
    status: string;
    archivedAt: number | null;
    sites: { id: string; name: string; latitude: string | null }[];
  }

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-entities-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-entities-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Lina SRL', 'MD')`, [
        ORG,
      ]),
    );

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(
          `INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`,
          [account.accountId, ORG, role],
        ),
      );
    }
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    await asOrganization(owner, ORG, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [ORG]),
    );
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
    await app?.close();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
  });

  describe('an administrator maintains the entity (UC-52, UC-53)', () => {
    it('creates one with its activity codes and a located site', async () => {
      const created = await http()
        .post('/api/v1/entities')
        .set(admin.authorization)
        .send({
          name: 'Brutăria Lina',
          legalForm: 'srl',
          naceCodes: ['10.71'],
          sites: [
            {
              name: 'Fabrica Chișinău',
              locality: 'Chișinău',
              countryCode: 'md',
              latitude: '47.024512',
              longitude: '28.832363',
            },
          ],
        })
        .expect(201);

      const entity = (created.body as { object: EntityBody }).object;
      entityId = entity.id;

      expect(entity.naceCodes).toEqual(['10.71']);
      expect(entity.status).toBe(ENTITY_STATUS.ACTIVE);
      expect(entity.sites).toHaveLength(1);
      // A decimal string, not a number — the column is `numeric` because NFR-58 forbids float, and
      // parsing it at the boundary would reintroduce exactly what the column avoids. B5's
      // biodiversity determination is evaluated from these (BR-APP-3).
      expect(entity.sites[0].latitude).toBe('47.024512');
    });

    it('refuses an activity code the classifier does not register', async () => {
      const refused = await http()
        .post('/api/v1/entities')
        .set(admin.authorization)
        .send({ name: 'Nowhere SRL', naceCodes: ['99.99'] })
        .expect(400);

      // Well-formed as a NACE code and absent from CAEM Rev.2 — the case a shape check cannot see.
      expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/nace-code-unknown`);
    });

    it('edits master data, and the sites array is a save rather than an append', async () => {
      const before = await http()
        .get(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .expect(200);
      const siteId = (before.body as { object: EntityBody }).object.sites[0].id;

      const updated = await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({
          naceCodes: ['10.71', '56.10'],
          sites: [
            { id: siteId, name: 'Fabrica Chișinău', locality: 'Chișinău' },
            { name: 'Punct de desfacere Bălți', locality: 'Bălți' },
          ],
        })
        .expect(200);

      const entity = (updated.body as { object: EntityBody }).object;
      expect(entity.naceCodes).toEqual(['10.71', '56.10']);
      expect(entity.sites).toHaveLength(2);
      // The kept site keeps its id, which is what makes the change history record a changed field
      // rather than one site vanishing and an unrelated one appearing (FR-54).
      expect(entity.sites.map((site) => site.id)).toContain(siteId);
    });

    it('removes a site the array omits', async () => {
      const updated = await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({ sites: [{ name: 'Fabrica Chișinău', locality: 'Chișinău' }] })
        .expect(200);

      expect((updated.body as { object: EntityBody }).object.sites).toHaveLength(1);
    });

    it('leaves the sites alone when the patch does not mention them', async () => {
      const updated = await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({ name: 'Brutăria Lina SRL' })
        .expect(200);

      const entity = (updated.body as { object: EntityBody }).object;
      expect(entity.name).toBe('Brutăria Lina SRL');
      // Absent is not empty. A client that forgot to send `sites` must not lose them.
      expect(entity.sites).toHaveLength(1);
    });
  });

  describe('a Reporting Contributor reads and does not write (D-2, UC-19)', () => {
    it('lists the organization’s entities', async () => {
      const listed = await http().get('/api/v1/entities').set(editor.authorization).expect(200);

      // The read is open because B1 pre-populates from this record and the RC is who fills B1 in.
      expect((listed.body as { objects: EntityBody[] }).objects.length).toBeGreaterThan(0);
    });

    it('reads one entity', async () => {
      await http().get(`/api/v1/entities/${entityId}`).set(editor.authorization).expect(200);
    });

    it.each([
      ['create', () => http().post('/api/v1/entities').send({ name: 'X' })],
      ['edit', () => http().patch(`/api/v1/entities/${entityId}`).send({ name: 'X' })],
      ['archive', () => http().post(`/api/v1/entities/${entityId}/archive`).send({})],
    ])('is refused when it tries to %s', async (_label, call) => {
      const refused = await call().set(editor.authorization).expect(403);
      expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/insufficient-role`);
    });
  });

  describe('archiving (UC-55, FR-20)', () => {
    it('archives, and the entity remains readable with its history intact', async () => {
      await http()
        .post(`/api/v1/entities/${entityId}/archive`)
        .set(admin.authorization)
        .send({})
        .expect(204);

      const after = await http()
        .get(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .expect(200);

      const entity = (after.body as { object: EntityBody }).object;
      expect(entity.status).toBe(ENTITY_STATUS.ARCHIVED);
      expect(entity.archivedAt).toEqual(expect.any(Number));
      // FR-20's whole point: it leaves active selection and nothing it produced is lost.
      expect(entity.sites).toHaveLength(1);
    });

    it('refuses to edit an archived entity, as a state conflict rather than a 404', async () => {
      const refused = await http()
        .patch(`/api/v1/entities/${entityId}`)
        .set(admin.authorization)
        .send({ name: 'Renamed' })
        .expect(409);

      expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/entity-archived`);
    });

    it('refuses to archive it twice', async () => {
      await http()
        .post(`/api/v1/entities/${entityId}/archive`)
        .set(admin.authorization)
        .send({})
        .expect(409);
    });
  });
});

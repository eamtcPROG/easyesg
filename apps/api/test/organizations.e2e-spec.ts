import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { ORGANIZATION_LEGAL_FORM_CONFIG_KIND } from '../src/modules/core/organization/constants/organization.constants';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs } from './support/database';
import {
  cleanupSignedInAccounts,
  signInFreshAccount,
  type SignedInAccount,
} from './support/signed-in-account';

/**
 * UC-49 and UC-50 end to end (FR-13, FR-14, FR-15) — task 29.1's deliverable: *"create-and-edit as
 * OA; the creator holds OA on the new organization"*.
 *
 * **The founding grant is what this suite exists to prove, and it is proved by using it rather
 * than by reading it back.** Asserting a membership row exists would only say that an `INSERT`
 * ran; the test below creates an organization and then reaches `PATCH /organization`, which is
 * behind `@RequiresRole(organization_administrator)` and resolves the role from the membership
 * table per request. Reaching it at all *is* D-1.
 *
 * **The legal-form vocabulary is published against the running application**, exactly as
 * `social-auth.e2e-spec.ts` does for FR-82 — the payload is read from the committed seed file, so
 * whatever revision this suite leaves behind holds the shipped values and the next `config:seed`
 * compares equal.
 *
 * Cross-tenant behaviour is not asserted here: `tenant-isolation.e2e-spec.ts` owns that, and the
 * role matrix over these routes is `route-matrix.e2e-spec.ts`'s.
 */

const EMAILS = {
  founder: 'founder@organizations.test',
  editor: 'editor@organizations.test',
};

/** Kept out of the vocabulary on purpose — the two refusals need a country and a form that are not. */
const UNSUPPORTED_COUNTRY = 'FR';
const UNREGISTERED_FORM = 'pfa';

interface Problem {
  type?: string;
  title?: string;
  detail?: string;
}

describe('organizations (UC-49, UC-50)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;

  let founder: SignedInAccount;
  let editor: SignedInAccount;
  /** The organization `founder` creates in the first test, reused by the profile tests below. */
  let foundedId: string;

  const http = () => request(app.getHttpServer());

  const seedLegalForms = async () => {
    const payload = JSON.parse(
      readFileSync(resolve(__dirname, '../../../config/seed/organization-legal-form.md.json'), 'utf8'),
    ) as Record<string, unknown>;
    await app.get(ConfigurationPublisher).publish({
      kind: ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
      scope: 'md',
      payload,
    });
    await app.get(ConfigurationStore).refreshIfStale();
  };

  /**
   * Organizations created by the route, removed through the owner with the tenant bound.
   *
   * `DELETE` needs `app.current_org` set to the row's own id, because the tenant root is scoped by
   * `id` and `FORCE ROW LEVEL SECURITY` subjects the owner to that policy too — an unbound delete
   * matches nothing and reports success. The membership goes with it on the cascade, which is the
   * only way it leaves: no runtime role holds `DELETE` on `identity.membership`.
   */
  const removeOrganization = async (organizationId: string) => {
    await asOrganization(owner, organizationId, (run) =>
      run(`DELETE FROM core.organization WHERE id = $1`, [organizationId]),
    );
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-organizations-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-organizations-worker');
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);

    await seedLegalForms();

    const server = app.getHttpServer();
    founder = await signInFreshAccount({ server, worker, email: EMAILS.founder });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
  }, 180_000);

  afterAll(async () => {
    if (foundedId) await removeOrganization(foundedId);
    await cleanupSignedInAccounts({ owner });
    await owner?.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [
      Object.values(EMAILS),
    ]);
    await app?.close();
    if (owner?.isInitialized) await owner.destroy();
    if (worker?.isInitialized) await worker.destroy();
  });

  describe('the vocabulary the founding form is built from (FR-15, AD-4)', () => {
    it('lists the countries an organization may be created in, and their legal forms', async () => {
      const response = await http()
        .get('/api/v1/organizations/legal-forms')
        .set(founder.authorization)
        .expect(200);

      const entries = (response.body as { objects: { countryCode: string; legalForms: string[] }[] })
        .objects;
      const moldova = entries.find((entry) => entry.countryCode === 'MD');
      expect(moldova?.legalForms).toContain('srl');
      // Keys, never labels — OQ-43 puts the wording in the committed catalogues, so an endpoint
      // answering "Societate cu Răspundere Limitată" would pin the language at the moment of read.
      expect(moldova?.legalForms.every((form) => /^[a-z][a-z0-9_]*$/u.test(form))).toBe(true);
    });
  });

  describe('creating an organization (UC-49, FR-13, D-1)', () => {
    it('creates it and makes the caller its Organization Administrator', async () => {
      const created = await http()
        .post('/api/v1/organizations')
        .set(founder.authorization)
        .send({
          name: 'Fabrica de Cașcaval SRL',
          countryCode: 'md',
          contactEmail: 'contact@cascaval.test',
        })
        .expect(201);

      const organization = (created.body as { object: { id: string; name: string; countryCode: string; legalForm: string | null } })
        .object;
      foundedId = organization.id;

      expect(organization.name).toBe('Fabrica de Cașcaval SRL');
      // Stored as ISO renders it, though the caller sent lower case.
      expect(organization.countryCode).toBe('MD');
      // S-04 does not collect the legal form; it is S-15's, and null is the honest answer.
      expect(organization.legalForm).toBeNull();

      // Read with the tenant bound. `membership_tenant_select` compares `organization_id` to
      // `app.current_org` and `FORCE ROW LEVEL SECURITY` subjects `esg_migrator` to it too, so the
      // same query unbound answers zero rows and reports no failure — which is what it did on the
      // first run of this test, and reads as "the grant did not happen".
      const membership = await asOrganization(owner, foundedId, (run) =>
        run(
          `SELECT role, status FROM identity.membership
            WHERE account_id = $1 AND organization_id = $2`,
          [founder.accountId, foundedId],
        ),
      );
      expect(membership).toEqual([
        { role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, status: 'active' },
      ]);
    });

    it('attributes the creation to the founder in the change history (FR-15)', async () => {
      // FR-15 requires every change attributed and timestamped, and nothing in the request tier
      // records one: `core.capture_field_change` does, reading the actor from `app.current_user`.
      // This is the assertion that the founding store binds it *before* the insert — bound after,
      // the founding rows would be attributed to nobody, permanently.
      const changes = await asOrganization(owner, foundedId, (run) =>
        run(
          `SELECT DISTINCT actor_id FROM core.field_change
            WHERE table_name = 'core.organization' AND record_id = $1`,
          [foundedId],
        ),
      );
      expect(changes).toEqual([{ actor_id: founder.accountId }]);
    });

    it('refuses a country that registers no legal-form vocabulary', async () => {
      const refused = await http()
        .post('/api/v1/organizations')
        .set(editor.authorization)
        .send({ name: 'Fromagerie SARL', countryCode: UNSUPPORTED_COUNTRY })
        .expect(400);

      const problem = refused.body as Problem;
      expect(problem.type).toBe(`${PROBLEM_BASE_URI}/country-not-supported`);
      // NFR-79's three parts reach the caller, and no internal identifier does — the corpus gate
      // proves the second claim for every message; this one proves the wording arrives at all.
      expect(problem.detail).toBeDefined();
      expect(problem.title).toBeDefined();
    });

    it('refuses an unauthenticated caller', async () => {
      await http()
        .post('/api/v1/organizations')
        .send({ name: 'Anonim SRL', countryCode: 'MD' })
        .expect(401);
    });
  });

  describe('the organization profile (UC-50, FR-15)', () => {
    it('is readable by the administrator the creation produced', async () => {
      const response = await http()
        .get('/api/v1/organization')
        .set(founder.authorization)
        .expect(200);

      // Reaching this route at all is D-1: it is behind `@RequiresRole(organization_administrator)`
      // and the role is resolved from the membership table on every request.
      expect((response.body as { object: { id: string } }).object.id).toBe(foundedId);
    });

    it('accepts a patch, leaves the fields it does not name, and clears on an explicit null', async () => {
      const first = await http()
        .patch('/api/v1/organization')
        .set(founder.authorization)
        .send({ legalForm: 'srl', registeredLocality: 'Chișinău', contactPhone: '+37322000000' })
        .expect(200);

      expect((first.body as { object: { legalForm: string } }).object.legalForm).toBe('srl');

      const second = await http()
        .patch('/api/v1/organization')
        .set(founder.authorization)
        .send({ contactPhone: null })
        .expect(200);

      const organization = (second.body as {
        object: { legalForm: string; registeredLocality: string; contactPhone: string | null };
      }).object;
      expect(organization.contactPhone).toBeNull();
      // Absent from the patch, so untouched — the distinction the whole patch type is written
      // around, and the one a `?? null` somewhere in the chain would quietly destroy.
      expect(organization.legalForm).toBe('srl');
      expect(organization.registeredLocality).toBe('Chișinău');
    });

    it('records each changed field against the acting user (FR-15)', async () => {
      const changes = await asOrganization(owner, foundedId, (run) =>
        run(
          `SELECT field_name, new_value FROM core.field_change
            WHERE record_id = $1 AND operation = 'UPDATE' AND actor_id = $2
            ORDER BY field_name`,
          [foundedId, founder.accountId],
        ),
      );
      // One row per column that moved, which is why the address is columns rather than jsonb: an
      // address held as one document would record "the address changed" and not which line.
      expect(changes).toEqual(
        expect.arrayContaining([
          { field_name: 'legal_form', new_value: 'srl' },
          { field_name: 'registered_locality', new_value: 'Chișinău' },
        ]),
      );
    });

    it('refuses a legal form the country does not register', async () => {
      const refused = await http()
        .patch('/api/v1/organization')
        .set(founder.authorization)
        .send({ legalForm: UNREGISTERED_FORM })
        .expect(400);

      expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/legal-form-unknown`);
    });

    it('refuses a country move that would strand the form the organization already holds', async () => {
      const refused = await http()
        .patch('/api/v1/organization')
        .set(founder.authorization)
        .send({ countryCode: UNSUPPORTED_COUNTRY })
        .expect(400);

      // The country registers nothing at all, so this is the outer refusal rather than the form
      // one — and the row is unchanged, which is what makes the two distinguishable.
      expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/country-not-supported`);

      const unchanged = await http()
        .get('/api/v1/organization')
        .set(founder.authorization)
        .expect(200);
      expect((unchanged.body as { object: { countryCode: string } }).object.countryCode).toBe('MD');
    });

    it('refuses a member of nothing, who has no organization to read', async () => {
      await http().get('/api/v1/organization').set(editor.authorization).expect(403);
    });
  });

  /**
   * FR-14 and NFR-9 — **and this block runs last on purpose.** It founds a second organization,
   * after which `selectActiveMembership` resolves *nothing* for the founder: two memberships and no
   * stated preference is the "several" branch, which answers null by design. Every test above needs
   * the founder to have exactly one.
   *
   * No MVP flow writes a relationship row (§7.2), so these statements are the only writer there is.
   * That is the point of the pair: what the schema must accept and what it must refuse are the two
   * halves of NFR-9's obligation that CI can hold, and they are opposite for the two typed axes.
   */
  describe('the typed relationship model (FR-14, NFR-9)', () => {
    let secondId: string;

    beforeAll(async () => {
      const created = await http()
        .post('/api/v1/organizations')
        .set(founder.authorization)
        .send({ name: 'Cașcaval Distribuție SRL', countryCode: 'MD' })
        .expect(201);
      secondId = (created.body as { object: { id: string } }).object.id;
    });

    afterAll(async () => {
      if (secondId) await removeOrganization(secondId);
    });

    const edge = (kind: string, organizationType: string) =>
      asOrganization(owner, foundedId, (run) =>
        run(
          `INSERT INTO core.org_relationship
             (organization_id, related_organization_id, kind, organization_type)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [foundedId, secondId, kind, organizationType],
        ),
      );

    it('accepts an edge of the type registered at MVP', async () => {
      expect(await edge('parent', 'direct_sme')).toHaveLength(1);
    });

    it('accepts a FOURTH organization type with no schema change — NFR-9', async () => {
      // The whole requirement, as a statement rather than a comment: `advisor` is not in the
      // migration, not in an `as const`, and not in any CHECK. Adding it is registering data.
      // A membership constraint on this column would fail this line, which is why there is none.
      expect(await edge('child', 'advisor')).toHaveLength(1);
    });

    it('refuses an unknown edge KIND, which is the axis the database does own', async () => {
      // The other half, and what makes the test above mean something. Parent/child/peer is the
      // shape of a graph and does not move with the commercial model, so it is a CHECK — without
      // this assertion, "a fourth type is accepted" would only be saying the column is `text`.
      await expect(edge('sibling', 'direct_sme')).rejects.toThrow(/org_relationship_kind_known/u);
    });

    it('refuses an organization relating to itself', async () => {
      await expect(
        asOrganization(owner, foundedId, (run) =>
          run(
            `INSERT INTO core.org_relationship
               (organization_id, related_organization_id, kind, organization_type)
             VALUES ($1, $1, 'peer', 'direct_sme')`,
            [foundedId],
          ),
        ),
      ).rejects.toThrow(/org_relationship_not_self/u);
    });
  });
});

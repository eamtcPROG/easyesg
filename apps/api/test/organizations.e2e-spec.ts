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
import { ORG_RELATIONSHIP_KIND } from '../src/modules/core/organization/models/organization.model';
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
    // Compared before publishing, because `ConfigurationPublisher.publish` always writes a new
    // immutable revision — the idempotent-by-comparison behaviour lives in the seed *loader*, not
    // the publisher. Publishing unconditionally would append a `config.entry_version` row and bump
    // `config.store_version` on every run of this suite, invalidating every replica's cached read
    // model for a change that changes nothing.
    const store = app.get(ConfigurationStore);
    await store.refreshIfStale();
    const current = store.get(ORGANIZATION_LEGAL_FORM_CONFIG_KIND, 'md');
    if (JSON.stringify(current?.payload) !== JSON.stringify(payload)) {
      await app.get(ConfigurationPublisher).publish({
        kind: ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
        scope: 'md',
        payload,
      });
      await store.refreshIfStale();
    }
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

    it('refuses a name that is only whitespace, rather than storing an empty one', async () => {
      // `@Length(1, 200)` measures whatever reaches it, so before `@Trim()` ran first this passed
      // validation and a `.trim()` in the use case then stored `''` — which `core.organization.name`
      // accepts, being `text NOT NULL`. The result was an organization nobody could identify in a
      // list. Trimming before validation is what makes the length check mean what it says.
      await http()
        .post('/api/v1/organizations')
        .set(editor.authorization)
        .send({ name: '   ', countryCode: 'MD' })
        .expect(400);
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

    /**
     * FR-16 over the wire (UC-51) — the half `packages/validation`'s corpus cannot show: that the
     * rule is actually reached by the route, and that the two failures arrive as different problem
     * types so S-15 can offer different resolutions.
     */
    describe('entity identifiers (UC-51, FR-16)', () => {
      const LEI = '7LTWFZYICNSX8D621K86'; // Deutsche Bank AG, a published value.
      const IDNO = '1003600158022';

      it('records the IDNO and the LEI, and returns them', async () => {
        const response = await http()
          .patch('/api/v1/organization')
          .set(founder.authorization)
          .send({ idno: IDNO, lei: LEI })
          .expect(200);

        const organization = (response.body as { object: { idno: string; lei: string } }).object;
        expect(organization.idno).toBe(IDNO);
        expect(organization.lei).toBe(LEI);
      });

      it('refuses a malformed IDNO', async () => {
        const refused = await http()
          .patch('/api/v1/organization')
          .set(founder.authorization)
          .send({ idno: '100360015802' })
          .expect(400);

        expect((refused.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/identifier-malformed`);
      });

      it('tells a malformed LEI apart from one whose check digits disagree', async () => {
        const malformed = await http()
          .patch('/api/v1/organization')
          .set(founder.authorization)
          .send({ lei: LEI.slice(0, 19) })
          .expect(400);
        expect((malformed.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/identifier-malformed`);

        // Two adjacent characters transposed: the shape is perfect and only the checksum sees it.
        // Different slug because the way out is different — check the register, not the keyboard.
        const checksum = await http()
          .patch('/api/v1/organization')
          .set(founder.authorization)
          .send({ lei: '7LTWFZYICNSX8D62K186' })
          .expect(400);
        expect((checksum.body as Problem).type).toBe(`${PROBLEM_BASE_URI}/identifier-check-digits`);
        expect((checksum.body as Problem).detail).toBeDefined();
      });

      it('leaves the stored identifiers untouched when a patch is refused', async () => {
        const response = await http()
          .get('/api/v1/organization')
          .set(founder.authorization)
          .expect(200);

        expect((response.body as { object: { lei: string } }).object.lei).toBe(LEI);
      });

      it('clears an identifier on an explicit null', async () => {
        const response = await http()
          .patch('/api/v1/organization')
          .set(founder.authorization)
          .send({ lei: null })
          .expect(200);

        expect((response.body as { object: { lei: string | null } }).object.lei).toBeNull();
      });
    });

    it('refuses a member of nothing, who has no organization to read', async () => {
      await http().get('/api/v1/organization').set(editor.authorization).expect(403);
    });
  });

  /**
   * FR-14 and NFR-9 — **and this block runs last because it moves the founder's active
   * organization**, which every test above needs pointed at the first one.
   *
   * It used to run last for a worse reason, and the first version of this comment recorded the
   * defect as though it were a design: founding a second organization left the founder with two
   * memberships and no stated preference, which `selectActiveMembership` answers with **null** — no
   * active organization at all, for the organization they were already using. The founding store
   * now points the session at what it just created, as invitation acceptance does, and the first
   * test below is that assertion.
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

    it('points the founder’s session at the organization they just created', async () => {
      // The lock-out this suite previously worked around by ordering. Two memberships with no
      // stated preference resolve to nothing, so without the session write the next request would
      // answer 403 for *both* organizations — and task 30.1's switcher, the only way to state a
      // preference, does not exist yet.
      const response = await http()
        .get('/api/v1/organization')
        .set(founder.authorization)
        .expect(200);

      expect((response.body as { object: { id: string } }).object.id).toBe(secondId);
    });

    it('accepts an edge of the type registered at MVP', async () => {
      expect(await edge(ORG_RELATIONSHIP_KIND.PARENT, 'direct_sme')).toHaveLength(1);
    });

    it('accepts a FOURTH organization type with no schema change — NFR-9', async () => {
      // The whole requirement, as a statement rather than a comment: `advisor` is not in the
      // migration, not in an `as const`, and not in any CHECK. Adding it is registering data.
      // A membership constraint on this column would fail this line, which is why there is none.
      expect(await edge(ORG_RELATIONSHIP_KIND.CHILD, 'advisor')).toHaveLength(1);
    });

    it('refuses an unknown edge KIND, which is the axis the database does own', async () => {
      // The other half, and what makes the test above mean something. Parent/child/peer is the
      // shape of a graph and does not move with the commercial model, so it is a CHECK — without
      // this assertion, "a fourth type is accepted" would only be saying the column is `text`.
      // A literal on purpose, and the one place in this block that must be one: the whole claim is
      // that a value outside the vocabulary is refused, which a member of the vocabulary cannot
      // express. CLAUDE.md's test exception covers exactly this.
      await expect(edge('sibling', 'direct_sme')).rejects.toThrow(/org_relationship_kind_known/u);
    });

    it('refuses an organization relating to itself', async () => {
      await expect(
        asOrganization(owner, foundedId, (run) =>
          run(
            `INSERT INTO core.org_relationship
               (organization_id, related_organization_id, kind, organization_type)
             VALUES ($1, $1, $2, 'direct_sme')`,
            [foundedId, ORG_RELATIONSHIP_KIND.PEER],
          ),
        ),
      ).rejects.toThrow(/org_relationship_not_self/u);
    });
  });
});

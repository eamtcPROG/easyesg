import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-15's profile on the tenant root, and FR-14's typed relationship model (task 29.1).
 *
 * Task 12's `core.organization` migration named both as deliberately absent and named this task as
 * their owner, so this is the expand step it anticipated rather than a second opinion about that
 * table.
 *
 * **The profile columns arrive nullable, and only `country_code` does not.** S-04 collects the
 * legal name, the country and the contact details; legal form, registered address and (in 29.2)
 * the identifiers are S-15's, entered later against an organization that already exists. A schema
 * demanding them at insert would contradict the screen that fills them in — and NOT NULL on a
 * column no creation flow supplies is a constraint that can only be satisfied by inventing a value.
 *
 * **`country_code` is `NOT NULL DEFAULT` then `DROP DEFAULT`, and that is not a shortcut around a
 * backfill — it is the only shape that works here.** `core.organization` carries `FORCE ROW LEVEL
 * SECURITY`, so an `UPDATE … WHERE country_code IS NULL` run by `esg_migrator` is filtered by
 * `organization_tenant_update` and matches **zero rows**, after which `SET NOT NULL` fails on the
 * rows it did not reach. Task 12's RLS migration states this consequence in terms. `ADD COLUMN` is
 * DDL and no policy applies to it, so the default fills every existing row in one statement; the
 * default is then dropped, so it never applies to a row created afterwards. `'MD'` is a backfill
 * value for pre-launch rows and never a standing default — the difference is the `DROP DEFAULT`.
 *
 * **The address is columns, not `jsonb`, and per-field audit is the reason.** `core.field_change`
 * compares row images key by key, so an address held as one `jsonb` column would record every
 * correction as a single change to a field called `registered_address` with the whole document as
 * its before and after. FR-54 asks who changed what; "the address" is not what.
 */
export class OrganizationProfile1788566400000 implements MigrationInterface {
  /** §7.6's expression, identical to task 12's so the two cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD COLUMN country_code             text NOT NULL DEFAULT 'MD',
        ADD COLUMN legal_form               text,
        ADD COLUMN registered_address_line1 text,
        ADD COLUMN registered_address_line2 text,
        ADD COLUMN registered_locality      text,
        ADD COLUMN registered_postal_code   text,
        ADD COLUMN contact_email            text,
        ADD COLUMN contact_phone            text
    `);
    await queryRunner.query(`ALTER TABLE core.organization ALTER COLUMN country_code DROP DEFAULT`);

    // ISO 3166-1 alpha-2, upper case, as a shape rather than a list. The *list* of countries the
    // platform will accept is the set that registers a legal-form vocabulary (AD-4, §7.2), which is
    // configuration; a CHECK enumerating 249 codes would be a second, stale copy of ISO's register
    // that only a migration could correct.
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD CONSTRAINT organization_country_code_iso CHECK (country_code ~ '^[A-Z]{2}$')
    `);

    // `legal_form` carries no CHECK on purpose, and this is the FR-14/FR-15 split made physical:
    // the permitted forms are configuration scoped by country (§7.2), so a constraint here would
    // be the DDL that AD-4 exists to remove. What the database still guarantees is the shape — a
    // key, not a sentence — so a label can never be stored where a code belongs.
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD CONSTRAINT organization_legal_form_key CHECK (legal_form ~ '^[a-z][a-z0-9_]*$')
    `);

    // ── FR-14: the typed relationship model ───────────────────────────────────────────────────
    //
    // No MVP flow writes a row here (§7.2). It is built now because adding it later is a migration
    // against a live filing window, which NFR-48 forbids in April and May.
    await queryRunner.query(`
      CREATE TABLE core.org_relationship (
        id                      uuid        PRIMARY KEY DEFAULT uuidv7(),
        -- **Both sides cascade, and the second one is the interesting choice.** Task 12 grants
        -- esg_app DELETE on the tenant root for NFR-28's thirty-day erasure, and the default
        -- NO ACTION would let *another* organization's edge refuse that deletion — an erasure
        -- request blocked by a third party's data, which is not a state the requirement admits.
        -- Cascading the far side removes A's edge when B is erased; the alternative is a dangling
        -- reference, since there is no third answer. Caught by task 29.1's own e2e cleanup, which
        -- could not delete either organization it had created.
        organization_id         uuid        NOT NULL
                                            REFERENCES core.organization (id) ON DELETE CASCADE,
        related_organization_id uuid        NOT NULL
                                            REFERENCES core.organization (id) ON DELETE CASCADE,
        kind                    text        NOT NULL,
        organization_type       text        NOT NULL,
        created_at              timestamptz NOT NULL DEFAULT now(),
        updated_at              timestamptz NOT NULL DEFAULT now(),

        -- The two typed axes of §7.2, and they are constrained differently on purpose. \`kind\` is
        -- the shape of a graph and does not move with the commercial model, so the database owns
        -- the set — mirrored by an \`as const\`, like every other closed vocabulary here.
        CONSTRAINT org_relationship_kind_known
          CHECK (kind IN ('parent', 'child', 'peer')),

        -- \`organization_type\` is NFR-9's axis and therefore carries NO membership constraint: a
        -- fourth type must be addable as configuration with zero schema migrations, and a CHECK
        -- here is exactly the migration that requirement forbids. The application admits a type
        -- against the registered vocabulary; the database guarantees only that it is a key.
        CONSTRAINT org_relationship_type_key
          CHECK (organization_type ~ '^[a-z][a-z0-9_]*$'),

        -- An organization is not its own parent, child or peer. Cheap, and the alternative is a
        -- cycle of length one that every future traversal has to remember to exclude.
        CONSTRAINT org_relationship_not_self
          CHECK (organization_id <> related_organization_id),

        UNIQUE (organization_id, related_organization_id, kind)
      )
    `);

    // Leads with `organization_id` because every RLS-filtered scan predicates on it (§7.3's third
    // structural note, which applies to any tenant table and not only to the disclosure store).
    await queryRunner.query(`
      CREATE INDEX org_relationship_related_idx
        ON core.org_relationship (organization_id, related_organization_id)
    `);

    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON core.org_relationship TO esg_app
    `);
    await queryRunner.query(`
      GRANT SELECT ON core.org_relationship TO esg_worker, esg_admin_ro
    `);

    await queryRunner.query(`ALTER TABLE core.org_relationship ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.org_relationship FORCE ROW LEVEL SECURITY`);

    // Scoped by `organization_id`, the ordinary clause — this is not the tenant root, so task 12's
    // exception does not apply and `WITH CHECK` is real. The edge belongs to the organization that
    // declares it; `related_organization_id` naming another tenant's row is what an edge is, and
    // reading it discloses an id the declaring tenant already holds.
    for (const [name, command, clause] of [
      ['org_relationship_tenant_select', 'SELECT', 'USING'],
      ['org_relationship_tenant_delete', 'DELETE', 'USING'],
      ['org_relationship_tenant_insert', 'INSERT', 'WITH CHECK'],
    ] as const) {
      await queryRunner.query(`
        CREATE POLICY ${name} ON core.org_relationship
          FOR ${command} ${clause} (organization_id = ${this.boundOrganization})
      `);
    }
    await queryRunner.query(`
      CREATE POLICY org_relationship_tenant_update ON core.org_relationship
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // Tenant master data, so FR-54 applies (P-11): the classification sweep in the schema-invariant
    // gate would fail the build for a tenant table that is neither audited nor listed as exempt.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.org_relationship
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The trigger, policies, grants and indexes all go with the table.
    await queryRunner.query(`DROP TABLE core.org_relationship`);

    await queryRunner.query(`
      ALTER TABLE core.organization
        DROP CONSTRAINT organization_legal_form_key,
        DROP CONSTRAINT organization_country_code_iso,
        DROP COLUMN country_code,
        DROP COLUMN legal_form,
        DROP COLUMN registered_address_line1,
        DROP COLUMN registered_address_line2,
        DROP COLUMN registered_locality,
        DROP COLUMN registered_postal_code,
        DROP COLUMN contact_email,
        DROP COLUMN contact_phone
    `);
  }
}

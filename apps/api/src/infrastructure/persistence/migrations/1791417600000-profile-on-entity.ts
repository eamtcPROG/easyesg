import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a report prints moves from the organization to each reporting entity (task 177; `architecture.md` §12.5.6's
 * task-177 row, project owner, 29 Sep 2026).
 *
 * **The organization is the account; the entity is what a report is about.** The registered address and the contact
 * printed on a report's cover are facts about the undertaking — a group's companies each have their own — so they
 * become `core.reporting_entity`'s (FR-15 and FR-17 as amended), where the snapshot a period freezes carries them. The
 * organization's `legal_form` is dropped rather than moved: it duplicated the entity's own, which B1 already read.
 * The columns keep task 29.1's and task 30.3's shapes — nullable, flat, no `CHECK` on an address or an email, whose
 * authorities are the DTOs — and `core.capture_field_change` audits them on the entity the moment they exist.
 *
 * **Nothing stated is lost, and nothing an entity already states is overwritten.** The address and the legal form go
 * to each organization's oldest active entity — else its oldest — filling only what it leaves empty; the report
 * contact goes to every entity that is active or receiving, since it printed on all their reports; an organization
 * holding any of these and no entity is given one, named after it.
 *
 * **`down` is lossy, and says so**: the organization takes back its receiving entity's values, the legal form among
 * them whatever the organization held before, and the columns leave every entity.
 *
 * No grant: `esg_app`, `esg_worker` and `esg_admin_ro` hold table-level privileges on `core.reporting_entity`, which
 * cover new columns.
 */
export class ProfileOnEntity1791417600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        ADD COLUMN registered_address_line1 text,
        ADD COLUMN registered_address_line2 text,
        ADD COLUMN registered_locality      text,
        ADD COLUMN registered_postal_code   text,
        ADD COLUMN report_contact_name      text,
        ADD COLUMN report_contact_email     text
    `);

    await moveProfileToEntities(queryRunner);

    await queryRunner.query(`
      ALTER TABLE core.organization
        DROP CONSTRAINT organization_legal_form_key,
        DROP COLUMN legal_form,
        DROP COLUMN registered_address_line1,
        DROP COLUMN registered_address_line2,
        DROP COLUMN registered_locality,
        DROP COLUMN registered_postal_code,
        DROP COLUMN report_contact_name,
        DROP COLUMN report_contact_email
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD COLUMN legal_form               text,
        ADD COLUMN registered_address_line1 text,
        ADD COLUMN registered_address_line2 text,
        ADD COLUMN registered_locality      text,
        ADD COLUMN registered_postal_code   text,
        ADD COLUMN report_contact_name      text,
        ADD COLUMN report_contact_email     text,
        ADD CONSTRAINT organization_legal_form_key CHECK (legal_form ~ '^[a-z][a-z0-9_]*$')
    `);

    await moveProfileToOrganizations(queryRunner);

    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        DROP COLUMN registered_address_line1,
        DROP COLUMN registered_address_line2,
        DROP COLUMN registered_locality,
        DROP COLUMN registered_postal_code,
        DROP COLUMN report_contact_name,
        DROP COLUMN report_contact_email
    `);
  }
}

/** Each organization's receiving entity: its oldest active one, else its oldest — task 175's order. */
const RECEIVING_ENTITY = `
  SELECT f.id FROM core.reporting_entity f
   WHERE f.organization_id = o.id
   ORDER BY (f.status = 'active') DESC, f.created_at, f.id
   LIMIT 1`;

/** An organization that states anything this migration moves. */
const HOLDS_PROFILE = `(o.legal_form IS NOT NULL
      OR o.registered_address_line1 IS NOT NULL OR o.registered_address_line2 IS NOT NULL
      OR o.registered_locality IS NOT NULL OR o.registered_postal_code IS NOT NULL
      OR o.report_contact_name IS NOT NULL OR o.report_contact_email IS NOT NULL)`;

/**
 * `up`'s data step (task 164's rule). `FORCE` is lifted around it, since the owner is subject to both tables' policies
 * and binds no organization; `core.capture_field_change` records each move with no actor, which is what a migration is.
 * The new columns are empty on every entity when this runs, so only the legal form needs `COALESCE` to leave an
 * entity's own value standing.
 */
export async function moveProfileToEntities(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.reporting_entity NO FORCE ROW LEVEL SECURITY`);

  await queryRunner.query(`
    UPDATE core.reporting_entity e
       SET legal_form               = COALESCE(e.legal_form, o.legal_form),
           registered_address_line1 = o.registered_address_line1,
           registered_address_line2 = o.registered_address_line2,
           registered_locality      = o.registered_locality,
           registered_postal_code   = o.registered_postal_code
      FROM core.organization o
     WHERE e.id = (${RECEIVING_ENTITY})
  `);
  await queryRunner.query(`
    UPDATE core.reporting_entity e
       SET report_contact_name  = o.report_contact_name,
           report_contact_email = o.report_contact_email
      FROM core.organization o
     WHERE e.organization_id = o.id
       AND (e.status = 'active' OR e.id = (${RECEIVING_ENTITY}))
  `);
  await queryRunner.query(`
    INSERT INTO core.reporting_entity
           (organization_id, name, legal_form, registered_address_line1, registered_address_line2,
            registered_locality, registered_postal_code, report_contact_name, report_contact_email)
    SELECT o.id, o.name, o.legal_form, o.registered_address_line1, o.registered_address_line2,
           o.registered_locality, o.registered_postal_code, o.report_contact_name, o.report_contact_email
      FROM core.organization o
     WHERE ${HOLDS_PROFILE}
       AND NOT EXISTS (SELECT 1 FROM core.reporting_entity e WHERE e.organization_id = o.id)
  `);

  await queryRunner.query(`ALTER TABLE core.reporting_entity FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.organization FORCE ROW LEVEL SECURITY`);
}

/** `down`'s data step: each organization takes back its receiving entity's values. */
export async function moveProfileToOrganizations(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.reporting_entity NO FORCE ROW LEVEL SECURITY`);

  await queryRunner.query(`
    UPDATE core.organization o
       SET legal_form               = e.legal_form,
           registered_address_line1 = e.registered_address_line1,
           registered_address_line2 = e.registered_address_line2,
           registered_locality      = e.registered_locality,
           registered_postal_code   = e.registered_postal_code,
           report_contact_name      = e.report_contact_name,
           report_contact_email     = e.report_contact_email
      FROM core.reporting_entity e
     WHERE e.id = (${RECEIVING_ENTITY})
  `);

  await queryRunner.query(`ALTER TABLE core.reporting_entity FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.organization FORCE ROW LEVEL SECURITY`);
}

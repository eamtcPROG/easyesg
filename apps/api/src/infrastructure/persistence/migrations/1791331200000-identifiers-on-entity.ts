import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-16's identifiers move from the organization to each reporting entity (task 175; `architecture.md` §12.5.6's
 * task-175 row, project owner, 29 Sep 2026).
 *
 * **The organization is the account; the entity is the reporting undertaking**, and EFRAG's VSME Digital Template
 * carries one *Entity Identifier* per report — the undertaking's. On the organization, a group's companies would all
 * have reported under one IDNO. Task 29.2's decisions travel with the columns unchanged: nullable, since an entity
 * exists before its identifiers are known and task 40's rule is what requires one for filing; shape-only CHECKs, the
 * IDNO's stopping short of a check digit whose algorithm no instrument states; a partial index for the support reads;
 * and **no uniqueness**, which would be an existence oracle over the company register (§7.2).
 *
 * **Nothing held is lost**: an organization's IDNO and LEI move to its oldest entity — an active one first, since an
 * archived entity's master data is frozen (FR-20) — and an organization holding identifiers and no entity is given a
 * first entity, named after it, to hold them. An organization without identifiers is left as it was.
 *
 * **`down` is lossy, and says so**: the identifiers of each organization's oldest entity go back to the organization,
 * a later entity's are dropped with the columns, and the entities `up` created stay.
 *
 * No grant: `esg_app` holds table-level privileges on `core.reporting_entity` (task 29), which cover new columns, and
 * `esg_worker` and `esg_admin_ro` hold table-level `SELECT` there too.
 */
export class IdentifiersOnEntity1791331200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        ADD COLUMN idno text,
        ADD COLUMN lei  text,
        ADD CONSTRAINT reporting_entity_idno_shape CHECK (idno ~ '^[0-9]{13}$'),
        ADD CONSTRAINT reporting_entity_lei_shape  CHECK (lei ~ '^[A-Z0-9]{18}[0-9]{2}$')
    `);
    await queryRunner.query(`
      CREATE INDEX reporting_entity_idno_idx ON core.reporting_entity (idno) WHERE idno IS NOT NULL
    `);

    await moveIdentifiersToEntities(queryRunner);

    await queryRunner.query(`DROP INDEX core.organization_idno_idx`);
    await queryRunner.query(`
      ALTER TABLE core.organization
        DROP CONSTRAINT organization_idno_shape,
        DROP CONSTRAINT organization_lei_shape,
        DROP COLUMN idno,
        DROP COLUMN lei
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD COLUMN idno text,
        ADD COLUMN lei  text,
        ADD CONSTRAINT organization_idno_shape CHECK (idno ~ '^[0-9]{13}$'),
        ADD CONSTRAINT organization_lei_shape  CHECK (lei ~ '^[A-Z0-9]{18}[0-9]{2}$')
    `);
    await queryRunner.query(`
      CREATE INDEX organization_idno_idx ON core.organization (idno) WHERE idno IS NOT NULL
    `);

    await moveIdentifiersToOrganizations(queryRunner);

    await queryRunner.query(`DROP INDEX core.reporting_entity_idno_idx`);
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        DROP CONSTRAINT reporting_entity_idno_shape,
        DROP CONSTRAINT reporting_entity_lei_shape,
        DROP COLUMN idno,
        DROP COLUMN lei
    `);
  }
}

/** Each organization's receiving entity: its oldest active one, else its oldest — the order both steps share. */
const RECEIVING_ENTITY = `
  SELECT f.id FROM core.reporting_entity f
   WHERE f.organization_id = o.id
   ORDER BY (f.status = 'active') DESC, f.created_at, f.id
   LIMIT 1`;

/**
 * `up`'s data step (task 164's rule): each organization's identifiers onto its receiving entity, and a first entity
 * for an organization that holds identifiers and has none. `FORCE` is lifted around it, since the owner is subject to
 * both tables' policies and binds no organization; `core.capture_field_change` records each move with no actor, which
 * is what a migration is.
 */
export async function moveIdentifiersToEntities(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.reporting_entity NO FORCE ROW LEVEL SECURITY`);

  await queryRunner.query(`
    UPDATE core.reporting_entity e
       SET idno = o.idno, lei = o.lei
      FROM core.organization o
     WHERE (o.idno IS NOT NULL OR o.lei IS NOT NULL)
       AND e.id = (${RECEIVING_ENTITY})
  `);
  await queryRunner.query(`
    INSERT INTO core.reporting_entity (organization_id, name, idno, lei)
    SELECT o.id, o.name, o.idno, o.lei
      FROM core.organization o
     WHERE (o.idno IS NOT NULL OR o.lei IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM core.reporting_entity e WHERE e.organization_id = o.id)
  `);

  await queryRunner.query(`ALTER TABLE core.reporting_entity FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.organization FORCE ROW LEVEL SECURITY`);
}

/** `down`'s data step: each organization's receiving entity's identifiers back onto the organization. */
export async function moveIdentifiersToOrganizations(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.reporting_entity NO FORCE ROW LEVEL SECURITY`);

  await queryRunner.query(`
    UPDATE core.organization o
       SET idno = e.idno, lei = e.lei
      FROM core.reporting_entity e
     WHERE e.id = (${RECEIVING_ENTITY})
       AND (e.idno IS NOT NULL OR e.lei IS NOT NULL)
  `);

  await queryRunner.query(`ALTER TABLE core.reporting_entity FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE core.organization FORCE ROW LEVEL SECURITY`);
}

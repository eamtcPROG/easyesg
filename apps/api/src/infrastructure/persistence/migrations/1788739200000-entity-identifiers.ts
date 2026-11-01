import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-16's entity identifiers on the tenant root — IDNO primary, LEI optional (task 29.2, OQ-18).
 *
 * **Two columns, not a typed identifier table.** OQ-18 settles this in terms: the scheme was
 * "deliberately *not* generalised into a typed multi-identifier list — that would ship an
 * abstraction ahead of a second identifier that anyone has asked for". DUNS, EU ID and PermID are
 * not modelled at MVP, so there is no list to be a row of.
 *
 * **Both are nullable, and `idno` being nullable is a decision rather than a concession.** S-04 does
 * not collect identifiers and S-15 does, so an organization exists before it has one. What makes the
 * IDNO *required* is that B1 cannot be filed without it — a validation rule interpreted from
 * configuration (FR-73, task 40), which is where every other B1 field's enforcement lives. A
 * `NOT NULL` here would instead refuse the profile screen its half-complete state.
 *
 * **No unique index on `idno`, and §7.2 records why.** A platform-wide uniqueness constraint would
 * be an existence oracle over the Moldovan company register crossed with our customer list: anyone
 * could learn which companies use the platform by observing which IDNOs are refused. It would also
 * need a cross-tenant read that no RLS policy grants. Duplicates are permitted and the question is
 * operational, beside T-2's billing reconciliation.
 *
 * **The CHECKs are shape only, and the IDNO's stops short of the check digit on purpose.** The
 * thirteenth digit is a check digit — Government Decision 272/2002 point 5 says so — but neither
 * consolidated version of that instrument carries the algorithm, and a candidate tested against
 * twelve real IDNOs reproduced two of them, which is chance (§7.2). A constraint enforcing a wrong
 * checksum would refuse real registrations at the door, which is worse than the filing-time error
 * FR-16 exists to prevent. `packages/validation` holds the shape rule for all three callers; these
 * constraints are the database's own copy of what is actually known.
 */
export class EntityIdentifiers1788739200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD COLUMN idno text,
        ADD COLUMN lei  text
    `);

    // Thirteen digits. Stored as `text` rather than a numeric type for the reason every identifier
    // is: leading zeros are significant, and no arithmetic is ever performed on it.
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD CONSTRAINT organization_idno_shape CHECK (idno ~ '^[0-9]{13}$')
    `);

    // ISO 17442: twenty characters, upper case, the last two numeric. The MOD 97-10 check digits
    // are verified in the application — expressible in SQL only as something nobody would maintain.
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD CONSTRAINT organization_lei_shape CHECK (lei ~ '^[A-Z0-9]{18}[0-9]{2}$')
    `);

    // Partial, because the only question asked of this column is "which organization has this
    // IDNO" and a row without one is never the answer. It exists for the support and reconciliation
    // reads §7.2 leaves as operational, not for a uniqueness check the schema deliberately omits.
    await queryRunner.query(`
      CREATE INDEX organization_idno_idx ON core.organization (idno) WHERE idno IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX core.organization_idno_idx`);
    await queryRunner.query(`
      ALTER TABLE core.organization
        DROP CONSTRAINT organization_lei_shape,
        DROP CONSTRAINT organization_idno_shape,
        DROP COLUMN idno,
        DROP COLUMN lei
    `);
  }
}

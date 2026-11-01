import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `core.organization` — the tenant root, and the first table the column conventions are visible in.
 *
 * **Why this table and only this table.** It is what `app.current_org` names (AD-2, §7.6), so tasks
 * 11 and 12 need it to exist before a tenant context can be bound or a policy written against it.
 * The rest of §7.10's core inventory belongs to the tasks that own those flows.
 *
 * **What is deliberately absent, so nobody "completes" it in passing:**
 *
 *  - **FR-15's profile fields** (legal form, registered address, contact details) and **FR-16's
 *    identifiers** (IDNO primary, LEI optional — OQ-18, closed 18 Aug 2026) are task 29's. They
 *    arrive by expand→migrate→contract (§7.9), which PostgreSQL 18 makes cheap: `NOT NULL ...
 *    NOT VALID` avoids the validating scan under ACCESS EXCLUSIVE that NFR-48 forbids in the
 *    filing window. Modelling them now would be guessing at nullability and validation that FR-16
 *    puts in the application.
 *  - **RLS.** Task 12 owns the policies, and they must be written with `FORCE ROW LEVEL SECURITY`
 *    (§7.6): `esg_migrator` owns this table, and an owner is exempt from its own policies
 *    regardless of `rolbypassrls`.
 *  - **An `updated_at` trigger.** Task 14's per-field audit capture already owns the central
 *    mutation path — it is the `RETURNING old.*, new.*` statement (AD-14, constraint 5) — so the
 *    column is maintained there rather than by a trigger written now. Writing one here would also
 *    force a decision this task should not take: where a function shared by `core` and `billing`
 *    lives, when DR-1 says the two contexts share nothing.
 */
export class CoreOrganization1787140800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The conventions of §7.9, and each is the decision rather than a default:
    //
    //  - `uuidv7()` — native in PostgreSQL 18, no extension. Time-ordered, so inserts stay at the
    //    right edge of the B-tree instead of v4's scatter, WAL inflation and page splits. NOT for
    //    externally visible tokens (verification, reset, invitation), which encode their creation
    //    time and must stay unguessable per NFR-64 — those are task 19's and take random values.
    //  - `timestamptz`, never `timestamp` (OQ-50, closed 19 Aug 2026). The wire representation is
    //    an epoch-millisecond integer and the conversion happens where a row becomes a DTO — §6.8
    //    owns that contract, §7.8 owns this column, and the two are not the same statement.
    //  - No `float` anywhere, ever (NFR-58). Disclosure quantities are `numeric`; money is integer
    //    minor units. The schema-invariant gate asserts both, so the rule is not left to review.
    await queryRunner.query(`
      CREATE TABLE core.organization (
        id         uuid        PRIMARY KEY DEFAULT uuidv7(),
        name       text        NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Per-table, because the baseline granted schema USAGE only — which grants the right to name
    // an object and nothing more. A table added without its grant is unreachable by every runtime
    // role, which is the default-deny this posture is for.
    //
    // `esg_app` gets the full DML set. DELETE is included on purpose: NFR-28 requires erasure
    // requests to be fulfillable within 30 days, and NFR-29 governs what survives one. `esg_worker`
    // reads only — it renders this tenant's record into a PDF, an export and an e-Factura payload,
    // and never administers the organization.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON core.organization TO esg_app;
    `);
    await queryRunner.query(`GRANT SELECT ON core.organization TO esg_worker, esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The grants go with the table; no separate REVOKE is needed or wanted — revoking first would
    // leave a window where the table exists and is unreachable if the drop then failed.
    await queryRunner.query(`DROP TABLE core.organization`);
  }
}

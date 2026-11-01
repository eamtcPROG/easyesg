import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline — the five schemas of §7.1 and the one extension §12.3 depends on.
 *
 * This migration holds no tables. §7.1's schema split and btree_gist are the substrate every
 * later migration builds on, and separating them buys the thing NFR-53 asks for: the
 * foundation can be proven to apply and revert from an empty database before a single column
 * exists to complicate the proof.
 *
 * Two things about it that are load-bearing rather than stylistic:
 *
 *  - **The SQL is hand-authored** (AD-14, constraint 1). Not queryRunner.createSchema(), which
 *    exists and would work here — the constraint is that migrations stay readable as SQL,
 *    because everything that follows (RLS policies, GRANT/REVOKE, WITHOUT OVERLAPS keys,
 *    statement-level triggers) has no builder equivalent at all. A migration set that is half
 *    builder calls and half raw SQL is harder to review than one that is all SQL.
 *  - **Every object is schema-qualified.** TypeORM's postgres driver does not set search_path,
 *    so an unqualified CREATE in any migration lands wherever the migration role's default
 *    search_path points — public, here, since no schema is named after esg_migrator. That is
 *    a silent wrong answer rather than an error. Qualify everything, always.
 *
 * The role names are literals because §7.6 fixes them and infra/postgres/init/init.sh creates
 * exactly those four in every environment. Parameterising them would imply a choice that is
 * not available.
 */
export class Baseline1787097600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // §12.3: the strongest single argument for PostgreSQL 18 here. AD-4 effective-dates six
    // configuration artefacts, and `PRIMARY KEY (scope, validity WITHOUT OVERLAPS)` needs
    // btree_gist to mix scalar equality with range exclusion in one index. Installed at the
    // base rather than by the first table that wants it, so no config table can be authored
    // without it and quietly fall back to an application-level overlap check.
    //
    // Explicitly WITH SCHEMA public — where init.sh's comment says extensions live, and the
    // one schema esg_migrator is granted CREATE on outside the five. No IF NOT EXISTS: if
    // something else already installed it, this migration does not own it and `down` must not
    // drop it, so failing here is the correct answer.
    await queryRunner.query(`CREATE EXTENSION btree_gist WITH SCHEMA public`);

    // §7.1. Ordered as that table lists them. Each is a bounded context's storage and nothing
    // else: `billing` deliberately holds no foreign key to core.organization (NFR-15, T-2),
    // which is why the two can never share a transaction and why task 64's nightly job exists
    // to report orphans as an operational metric.
    await queryRunner.query(`CREATE SCHEMA identity`);
    await queryRunner.query(`CREATE SCHEMA core`);
    await queryRunner.query(`CREATE SCHEMA billing`);
    await queryRunner.query(`CREATE SCHEMA config`);
    await queryRunner.query(`CREATE SCHEMA audit`);

    // USAGE only. It grants the right to *name* an object in these schemas and nothing more —
    // every table privilege is granted per table by the migration that creates it, so a table
    // added later is unreachable by every runtime role until someone writes the grant down.
    // That default-deny is free (PostgreSQL grants new tables to nobody but their owner) and
    // it is what makes task 13's append-only REVOKEs a tightening rather than a correction.
    await queryRunner.query(`
      GRANT USAGE ON SCHEMA identity, core, billing, config, audit
        TO esg_app, esg_worker, esg_admin_ro
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // RESTRICT — PostgreSQL's default, stated here by omission of CASCADE and by this comment.
    // CASCADE would make reverting the baseline out of order silently destroy every table a
    // later migration created; RESTRICT makes it fail with the dependency named. A revert that
    // refuses is recoverable, and one that succeeds by dropping a tenant's reporting history
    // is not.
    await queryRunner.query(`DROP SCHEMA audit`);
    await queryRunner.query(`DROP SCHEMA config`);
    await queryRunner.query(`DROP SCHEMA billing`);
    await queryRunner.query(`DROP SCHEMA core`);
    await queryRunner.query(`DROP SCHEMA identity`);
    await queryRunner.query(`DROP EXTENSION btree_gist`);
  }
}

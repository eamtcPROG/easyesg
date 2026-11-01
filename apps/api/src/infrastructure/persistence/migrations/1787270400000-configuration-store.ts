import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The configuration store (DR-3, AD-4, P-2).
 *
 * DR-3 requires content, thresholds, factor sets, validation rules, notification behaviour and plan
 * definitions to change **without a redeploy**, publish within one working day of approval, and
 * revert in one step. AD-4 holds all twelve artefacts in one subsystem, each versioned
 * `draft → in_review → published → superseded`, published versions immutable, publication a single
 * transactional action that writes a new version and flips a pointer.
 *
 * **One generic store, artefacts as data.** The alternative — a typed table per artefact — means
 * twelve publish paths and twelve reverts to keep identical, and the failure is that the eleventh
 * differs subtly and nobody finds out until a revert is needed under pressure. It would also
 * contradict what DR-3 is for: CLAUDE.md's Open/Closed entry says extension happens in data, and
 * adding a taxonomy element or a threshold must need no code change. The accepted cost is that
 * payload shape is validated in application code rather than by column types — the same trade AD-3
 * already took for the disclosure store.
 *
 * **Two tables, and the split is what makes §7.9's stated constraint usable.** §7.9 and §12.3 both
 * specify `PRIMARY KEY (scope, validity WITHOUT OVERLAPS)` for effective-dated configuration, but
 * that cannot sit on a table that also keeps superseded versions: two versions of one scope
 * necessarily cover overlapping dates, so every supersession would violate it. `entry_version`
 * therefore holds every version and no validity at all, and `entry_schedule` holds only what is in
 * force — which is exactly AD-4's pointer, and the table §7.9 was describing.
 */
export class ConfigurationStore1787270400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // A database enum rather than config, by the rule §7.10 states for the disclosure store: the
    // test is whether the value set changes with the standard. These four are fixed by AD-4, and a
    // fifth would be a genuine change in the meaning of the record — worth a migration.
    await queryRunner.query(`
      CREATE TYPE config.entry_state AS ENUM ('draft', 'in_review', 'published', 'superseded')
    `);

    // `kind` is the artefact (factor set, threshold, plan, locale registration…) and `scope` is
    // what it applies to. Both are text rather than enums for the opposite reason to the state
    // above: the set of artefacts grows with the product, and DR-3 exists so that growth needs no
    // migration.
    await queryRunner.query(`
      CREATE TABLE config.entry_version (
        id           uuid               PRIMARY KEY DEFAULT uuidv7(),
        kind         text               NOT NULL,
        scope        text               NOT NULL,
        revision     integer            NOT NULL,
        state        config.entry_state NOT NULL DEFAULT 'draft',
        payload      jsonb              NOT NULL,
        created_at   timestamptz        NOT NULL DEFAULT now(),
        created_by   uuid,
        published_at timestamptz,
        UNIQUE (kind, scope, revision)
      )
    `);

    // What is in force. The primary key is §7.9's form, applied to the only table it can be applied
    // to — verified on 18.4: overlapping ranges are refused, adjacent ones accepted, scopes
    // independent, and an unbounded upper bound allowed, which is what a non-effective-dated
    // artefact uses.
    //
    // This is the guarantee §12.3 calls the single strongest argument for PostgreSQL 18 here: two
    // factor sets in force for one date is a correctness bug of the worst kind — silent, and
    // visible only in a figure that was already reported (NFR-19, NFR-87).
    await queryRunner.query(`
      CREATE TABLE config.entry_schedule (
        kind       text      NOT NULL,
        scope      text      NOT NULL,
        validity   daterange NOT NULL,
        version_id uuid      NOT NULL REFERENCES config.entry_version (id),
        PRIMARY KEY (kind, scope, validity WITHOUT OVERLAPS)
      )
    `);

    // AD-4's authority for cache invalidation: "a cheap poll of a single-row version table (≤ 5 s)
    // is the authority, and a Redis pub/sub message is only a latency optimisation". Single-row by
    // construction — a boolean primary key with a CHECK that it is true admits exactly one row, so
    // there is no second row to disagree with the first.
    await queryRunner.query(`
      CREATE TABLE config.store_version (
        only_row   boolean     PRIMARY KEY DEFAULT true CHECK (only_row),
        version    bigint      NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`INSERT INTO config.store_version DEFAULT VALUES`);

    // Published versions are immutable (AD-4). Enforced here rather than in the publish service for
    // the same reason as every other guarantee in this schema: a service can be bypassed by the
    // next query someone writes, and an edited "published" version is indistinguishable afterwards
    // from one that was always that way — which is precisely what NFR-87 forbids, since a rule or
    // factor change must never silently restate a previously reported figure.
    //
    // The one permitted transition out of `published` is to `superseded`, which is how publication
    // of a successor retires it. Nothing else about the row may move.
    await queryRunner.query(`
      CREATE FUNCTION config.reject_published_edit() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is % and cannot be deleted',
            OLD.kind, OLD.scope, OLD.revision, OLD.state;
        END IF;

        IF OLD.state = 'published' AND NOT (
             NEW.state = 'superseded'
             AND NEW.payload  IS NOT DISTINCT FROM OLD.payload
             AND NEW.kind     IS NOT DISTINCT FROM OLD.kind
             AND NEW.scope    IS NOT DISTINCT FROM OLD.scope
             AND NEW.revision IS NOT DISTINCT FROM OLD.revision) THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is published and immutable; publish a successor',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        IF OLD.state = 'superseded' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is superseded and immutable',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        RETURN NEW;
      END
      $fn$
    `);
    await queryRunner.query(`
      CREATE TRIGGER reject_published_edit
        BEFORE UPDATE OR DELETE ON config.entry_version
        FOR EACH ROW EXECUTE FUNCTION config.reject_published_edit()
    `);

    // The version counter is bumped by the database, not by whoever remembered to. A publish that
    // does not bump it is a change no replica ever notices — the store is right and every reader is
    // wrong, indefinitely, which is the failure mode AD-4 rejected LISTEN/NOTIFY for.
    await queryRunner.query(`
      CREATE FUNCTION config.bump_store_version() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
      BEGIN
        UPDATE config.store_version SET version = version + 1, updated_at = now();
        RETURN NULL;
      END
      $fn$
    `);
    await queryRunner.query(`
      CREATE TRIGGER bump_store_version
        AFTER INSERT OR UPDATE OR DELETE ON config.entry_schedule
        FOR EACH STATEMENT EXECUTE FUNCTION config.bump_store_version()
    `);

    // Configuration is global rather than tenant data, so there is no organization_id and no RLS —
    // every tenant reads the same factor set. Authorization for *writing* is the admin realm's
    // (D-5, task 67); the grant here is what lets the API perform a publish at all.
    await queryRunner.query(`
      GRANT SELECT ON config.entry_version, config.entry_schedule, config.store_version
        TO esg_app, esg_worker, esg_admin_ro
    `);
    await queryRunner.query(`
      GRANT INSERT, UPDATE ON config.entry_version, config.entry_schedule TO esg_app
    `);
    // The counter is written only by the trigger above, which runs as the invoking role.
    await queryRunner.query(`GRANT UPDATE ON config.store_version TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE config.entry_schedule`);
    await queryRunner.query(`DROP TABLE config.entry_version`);
    await queryRunner.query(`DROP TABLE config.store_version`);
    await queryRunner.query(`DROP FUNCTION config.bump_store_version()`);
    await queryRunner.query(`DROP FUNCTION config.reject_published_edit()`);
    await queryRunner.query(`DROP TYPE config.entry_state`);
  }
}

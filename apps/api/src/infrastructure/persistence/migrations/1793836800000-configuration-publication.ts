import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Publications, drafts and review in the configuration store (tasks 67.14, 67.15; FR-61, FR-62; NFR-23; AD-4; 182/36,
 * 182/37; `architecture.md` §12.5.6's task-67.14/67.15 row).
 *
 * **A publication is a row** (row (1)): `config.publication` — when, by whom, and the editorial sign-off of each locale
 * (`sign_off`, a JSON object keyed by locale, each `{ by, at }`), immutable once written, since `esg_app` holds no
 * `UPDATE` on it. **Every version a set puts in force names it** (`entry_version.publication_id`), so a reviewed set of
 * several slots is one publication and each of its versions records the same identifier (182/36). A single-slot
 * publication through the old path — the seed, A-17, A-18, A-21 — names none, as before.
 *
 * **A draft is a version with no schedule entry** (row (2), 182/37): `state` `draft`, then `in_review`, both of which
 * `config.entry_state` has allowed since task 16 and nothing wrote. It has a revision — the next of its slot — and
 * keeps it when it is published, so a draft is promoted in place rather than copied. **One open draft per slot**
 * (`entry_version_one_open_draft`), so two editors of an article meet one draft rather than two. **A draft may be
 * deleted; nothing published may** — the trigger's `DELETE` arm now refuses only a version that has been in force, and
 * `esg_app` gains `DELETE`, which the trigger confines. `drafted_by` names who last saved it, a bare id.
 *
 * **The published row's fields stay frozen** in the published-to-superseded step, the new columns included.
 */
export class ConfigurationPublication1793836800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE config.publication (
        id           uuid        PRIMARY KEY DEFAULT uuidv7(),
        published_at timestamptz NOT NULL DEFAULT now(),
        published_by uuid,
        sign_off     jsonb       NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT publication_sign_off_object CHECK (jsonb_typeof(sign_off) = 'object')
      )
    `);
    await queryRunner.query(`GRANT SELECT, INSERT ON config.publication TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON config.publication TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`
      ALTER TABLE config.entry_version
        ADD COLUMN publication_id uuid REFERENCES config.publication(id),
        ADD COLUMN drafted_by uuid
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX entry_version_one_open_draft ON config.entry_version (kind, scope)
        WHERE state IN ('draft', 'in_review')
    `);
    await queryRunner.query(`
      CREATE INDEX entry_version_publication_idx ON config.entry_version (publication_id)
        WHERE publication_id IS NOT NULL
    `);
    await queryRunner.query(`GRANT DELETE ON config.entry_version TO esg_app`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION config.reject_published_edit() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.state IN ('draft', 'in_review') THEN
            RETURN OLD;
          END IF;
          RAISE EXCEPTION
            'configuration version %/% revision % is % and cannot be deleted',
            OLD.kind, OLD.scope, OLD.revision, OLD.state;
        END IF;

        IF OLD.state = 'published' AND NOT (
             NEW.state = 'superseded'
             AND NEW.payload        IS NOT DISTINCT FROM OLD.payload
             AND NEW.kind           IS NOT DISTINCT FROM OLD.kind
             AND NEW.scope          IS NOT DISTINCT FROM OLD.scope
             AND NEW.revision       IS NOT DISTINCT FROM OLD.revision
             AND NEW.validity       IS NOT DISTINCT FROM OLD.validity
             AND NEW.publication_id IS NOT DISTINCT FROM OLD.publication_id
             AND NEW.published_at   IS NOT DISTINCT FROM OLD.published_at) THEN
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Task 37.2's body, restored before the columns it would otherwise not name are dropped. Lossy: a draft has no
    // state to return to, so drafts go with the columns that describe them.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION config.reject_published_edit() RETURNS trigger
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
             AND NEW.revision IS NOT DISTINCT FROM OLD.revision
             AND NEW.validity IS NOT DISTINCT FROM OLD.validity) THEN
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
    await queryRunner.query(`REVOKE DELETE ON config.entry_version FROM esg_app`);
    await queryRunner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER USER`);
    await queryRunner.query(`DELETE FROM config.entry_version WHERE state IN ('draft', 'in_review')`);
    await queryRunner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER USER`);
    await queryRunner.query(`DROP INDEX config.entry_version_publication_idx`);
    await queryRunner.query(`DROP INDEX config.entry_version_one_open_draft`);
    await queryRunner.query(`ALTER TABLE config.entry_version DROP COLUMN drafted_by, DROP COLUMN publication_id`);
    await queryRunner.query(`DROP TABLE config.publication`);
  }
}

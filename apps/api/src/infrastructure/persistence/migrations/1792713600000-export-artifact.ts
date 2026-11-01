import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An export's record and where its file is (task 44.2; FR-49, FR-53, DR-4; `architecture.md` §12.5.6's task-44 row (2),
 * which gave 44.2 the storage half of task 47.1).
 *
 * **One row per export, written at the request and settled once by the worker.** The request tier inserts what was
 * asked — the report, the format, the language — and the row arrives `requested`; the export's job then records it
 * `completed`, with the moment the file was produced, where it is stored, its size and its digest, or `failed` after
 * its last attempt (§12.5.6's task-44 row (4)). The file itself is in object storage (§5), never here.
 *
 * **What the request cannot say, the database writes** — the `BEFORE INSERT` stamp, as `core.calc_run.recorded_by` and
 * the override attribution are: who asked, from the request's own `app.current_user`, so a caller cannot name someone
 * else; and the template and taxonomy version, copied from the report, whose pin nothing in the request tier can move
 * (§12.5.6's task-31.3 row) — so the record carries the version it was produced at (DR-4; FR-51 item 6) by
 * construction of the insert. The application is granted the four columns a request states and no other.
 *
 * **Settled is final** (FR-53 item 3): the update policy admits a row only while it is `requested`, so a completed or
 * failed record matches nothing — the owner included, under `FORCE` — and the worker may write only the outcome's
 * columns. No runtime role holds `DELETE`.
 *
 * **Inside a filing, and exempt from its lock**, as validation's runs are: a locked report is the one exported, and its
 * export must be recordable. **Not field-audited**: the row is the record of an export, and a trail of it would record
 * the writing of a record — `core.calc_run`'s reason. Both exemptions are named in `schema-invariants.e2e-spec.ts`.
 *
 * **Cascades from the report**, whose deletion is soft (FR-210), so only an organization's erasure takes it.
 */
export class ExportArtifact1792713600000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.export_artifact (
        id                uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id   uuid        NOT NULL,
        report_id         uuid        NOT NULL,

        -- What was asked: the file's format and its language, the export's own (FR-52).
        format            text        NOT NULL,
        locale            text        NOT NULL,

        -- Stamped at the insert, never stated by the request.
        template_version  text        NOT NULL,
        taxonomy_version  text        NOT NULL,
        requested_by      uuid        NOT NULL,
        requested_at      timestamptz NOT NULL DEFAULT now(),

        status            text        NOT NULL DEFAULT 'requested',
        -- The moment the file was produced — the one printed on its cover and in its metadata (NFR-22).
        generated_at      timestamptz,
        completed_at      timestamptz,
        object_key        text,
        byte_size         bigint,
        sha256            text,
        failed_at         timestamptz,
        -- Why the last attempt failed, for an operator; never shown to a reader as it stands.
        failure           text,

        CONSTRAINT export_artifact_format_known CHECK (format IN ('pdf')),
        CONSTRAINT export_artifact_locale_known CHECK (locale IN ('ro', 'en', 'ru')),
        CONSTRAINT export_artifact_status_known CHECK (status IN ('requested', 'completed', 'failed')),
        CONSTRAINT export_artifact_completed_whole CHECK (
          (status = 'completed') = (
            generated_at IS NOT NULL AND completed_at IS NOT NULL AND object_key IS NOT NULL
            AND byte_size IS NOT NULL AND sha256 IS NOT NULL
          )
        ),
        CONSTRAINT export_artifact_failed_whole CHECK ((status = 'failed') = (failed_at IS NOT NULL)),
        CONSTRAINT export_artifact_size_positive CHECK (byte_size IS NULL OR byte_size > 0),
        CONSTRAINT export_artifact_digest_hex CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),

        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);
    // The history a report's exports are read in, newest first (task 47.1).
    await queryRunner.query(`
      CREATE INDEX export_artifact_report_history
        ON core.export_artifact (organization_id, report_id, requested_at DESC)
    `);

    await queryRunner.query(`
      CREATE FUNCTION core.stamp_export_request() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        NEW.requested_by := NULLIF(current_setting('app.current_user', true), '')::uuid;
        IF NEW.requested_by IS NULL THEN
          RAISE EXCEPTION 'An export is requested by a person, and none is bound.' USING ERRCODE = 'not_null_violation';
        END IF;
        SELECT r.template_version, r.taxonomy_version
          INTO NEW.template_version, NEW.taxonomy_version
          FROM core.report r
         WHERE r.id = NEW.report_id AND r.organization_id = NEW.organization_id;
        NEW.requested_at := now();
        NEW.status := 'requested';
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER export_artifact_stamp_request
        BEFORE INSERT ON core.export_artifact
        FOR EACH ROW EXECUTE FUNCTION core.stamp_export_request()
    `);

    // ── Grants ──────────────────────────────────────────────────────────────────────────────────────────────────
    //
    // The request tier states the four things a request is and reads the record; the worker settles it, by column.
    await queryRunner.query(`GRANT SELECT ON core.export_artifact TO esg_app, esg_worker, esg_admin_ro`);
    await queryRunner.query(`
      GRANT INSERT (id, organization_id, report_id, format, locale) ON core.export_artifact TO esg_app
    `);
    await queryRunner.query(`
      GRANT UPDATE (status, generated_at, completed_at, object_key, byte_size, sha256, failed_at, failure)
        ON core.export_artifact TO esg_worker
    `);

    // ── Row-level security ──────────────────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE core.export_artifact ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.export_artifact FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY export_artifact_tenant_select ON core.export_artifact
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY export_artifact_tenant_insert ON core.export_artifact
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY export_artifact_tenant_settle ON core.export_artifact
        FOR UPDATE USING (organization_id = ${this.boundOrganization} AND status = 'requested')
        WITH CHECK (organization_id = ${this.boundOrganization})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.export_artifact`);
    await queryRunner.query(`DROP FUNCTION core.stamp_export_request()`);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A report's validation run and its findings (task 41.2; FR-40, FR-43, UC-40; `architecture.md` §12.5.6's task-182
 * validation row, 182/17, 182/21, 182/26, and task-41 row (g)).
 *
 * **Findings are the only home of a verdict** (182/17): a value row keeps answer semantics, and what a rule says about
 * it lives here, one row per finding. **A run replaces them** (FR-43): the latest run is the only one there is — a
 * corrected field's finding is gone the moment the next run writes, and no stale finding outlives the run that would
 * have cleared it. So `core.validation_run` holds one row per report, and the findings hang off it and go with it: a
 * run is a `DELETE` of the report's run, which cascades, then an `INSERT` of the new one and its findings, in the
 * request's transaction.
 *
 * **What a run records beside its findings**: when, by whom — from the request's own binding, as `calc_run` attributes,
 * so a caller cannot name someone else — and which rule set it read: the day, with the zone that settles it (§7.9; the
 * day is a legal-date question, FR-73 item 9), and the revision. A locked report reads the revision its lock pinned
 * (task-41 row (5)), so the day is the lock's then.
 *
 * **Inside the lock, and exempt from its trigger** (182/21, FR-43 AC-7): findings are derived, not filed content, and a
 * locked report is the one about to be exported — its warning must be computed from the rules, not frozen. The schema
 * invariant's exemption list names both tables. **Not field-audited**: a run's rows are the record of a computation,
 * and a trail of them would record the writing of a record, `calc_run`'s reason.
 *
 * **Cascades from the report.** A report is soft-deleted (FR-210), so the cascade fires only with the organization's
 * erasure, where derived rows have nothing to outlive.
 */
export class ValidationFindings1792281600000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.validation_run (
        organization_id   uuid        NOT NULL,
        report_id         uuid        NOT NULL,

        evaluated_at      timestamptz NOT NULL DEFAULT now(),
        evaluated_by      uuid        DEFAULT NULLIF(current_setting('app.current_user', true), '')::uuid,

        -- The rule set's day and the zone that settles it, and the revision read (FR-73 item 9).
        rules_on          date        NOT NULL,
        rules_on_tz       text        NOT NULL,
        rules_revision    int         NOT NULL,

        PRIMARY KEY (organization_id, report_id),
        CONSTRAINT validation_run_rules_revision_positive CHECK (rules_revision > 0),

        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE core.validation_finding (
        id                uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id   uuid        NOT NULL,
        report_id         uuid        NOT NULL,
        -- The interpreter's own order — rules, then the store's natural key — so a read lists them as the run did and
        -- two runs over unchanged answers read alike (BR-VAL-3).
        position          int         NOT NULL,

        rule_id           text        NOT NULL,
        -- FR-40's four verdicts, the value row's frozen CHECK members (182/17). OK is the absence of a finding.
        verdict           text        NOT NULL,
        -- The field it sits on: the disclosure store's natural key within the report (FR-42).
        element_key       text        NOT NULL,
        dimension_key     text        NOT NULL DEFAULT '',
        ordinal           int         NOT NULL DEFAULT 0,
        -- The fields it relates to, each an address as above (FR-42 item 4); empty where none.
        related           jsonb       NOT NULL DEFAULT '[]'::jsonb,
        -- The rule's catalogue key and the values its wording quotes — never the wording (OQ-43).
        message           text        NOT NULL,
        params            jsonb       NOT NULL DEFAULT '{}'::jsonb,

        CONSTRAINT validation_finding_verdict_known
          CHECK (verdict IN ('missing', 'inconsistency', 'error', 'invalid_url')),
        CONSTRAINT validation_finding_ordinal_non_negative CHECK (ordinal >= 0),
        CONSTRAINT validation_finding_related_is_list CHECK (jsonb_typeof(related) = 'array'),
        CONSTRAINT validation_finding_params_is_object CHECK (jsonb_typeof(params) = 'object'),
        UNIQUE (organization_id, report_id, position),

        FOREIGN KEY (organization_id, report_id)
          REFERENCES core.validation_run (organization_id, report_id) ON DELETE CASCADE,
        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    // ── Grants ──────────────────────────────────────────────────────────────────────────────────────────────────
    //
    // Replaced, never edited: inserted and deleted by the request tier, never updated. The worker reads them for an
    // export's warning and a notice's schedule (182/26), and the console's support reads under a grant.
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON core.validation_run, core.validation_finding TO esg_app`);
    await queryRunner.query(`
      GRANT SELECT ON core.validation_run, core.validation_finding TO esg_worker, esg_admin_ro
    `);

    // ── Row-level security ──────────────────────────────────────────────────────────────────────────────────────
    for (const table of ['validation_run', 'validation_finding']) {
      await queryRunner.query(`ALTER TABLE core.${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE core.${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_select ON core.${table}
          FOR SELECT USING (organization_id = ${this.boundOrganization})
      `);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_insert ON core.${table}
          FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
      `);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_delete ON core.${table}
          FOR DELETE USING (organization_id = ${this.boundOrganization})
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.validation_finding`);
    await queryRunner.query(`DROP TABLE core.validation_run`);
  }
}

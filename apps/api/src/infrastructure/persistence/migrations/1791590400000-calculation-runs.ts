import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The carbon calculator's invoice lines, and the runs that retain them (task 38.1; FR-33, FR-35, P-11, NFR-19;
 * `architecture.md` §12.5.6's task-38.1 row, project owner, 1 Oct 2026).
 *
 * **Two layers, because UX-41 and P-11 ask for different things of the same numbers.** UX-41 keeps a report's invoice
 * lines visible and editable after a calculation, and UX-34 saves them on blur — so they are a working set, one row
 * per line, audited like any other value a person types. P-11 and NFR-19 need the inputs a figure was computed from
 * **retained at the run**, unchanged by any later edit — so a run copies the lines it used. One table could not be
 * both: an editable row cannot also be the immutable record of what a filed figure rests on.
 *
 * - `core.calc_source` — the working set, owned by the report: which energy source, at which of the report's B1
 *   sites, how much in which invoice unit, or why the quantity is not available.
 * - `core.calc_run` — one calculation committed: the factor set it pinned (FR-35) and who ran it.
 * - `core.calc_input` — §7.2's `CALC_INPUT`, *"raw, retained permanently"*: each line as the run read it.
 *
 * **A line's site is the report's own B1 site row**, its ordinal on `IdentifierOfSiteTypedAxis` — the sites the report
 * discloses, which is the boundary FR-19 says every quantitative figure is gathered against. Not `core.site`: the
 * entity's master record moves after the period opens, and a consolidated report's subsidiaries have no site rows at
 * all. Which ordinals are rows is the taxonomy's and the snapshot's business, so it is the use case's to check; the
 * column holds the ordinal and nothing joins it.
 *
 * **The runs are immutable by grant and permanent by key.** `esg_app` holds `SELECT` and `INSERT` on both run tables
 * and nothing else, so no request can rewrite a figure's inputs (NFR-87), and their foreign keys into `core.report`
 * take no `ON DELETE` action: OQ-20 retains calculator inputs permanently, so a report a run rests on cannot be deleted
 * out from under it. The working set cascades with its report, which is the life the artboard gives it.
 */
export class CalculationRuns1791590400000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.calc_source (
        -- **Chosen by the client**, so an autosave the offline queue replays (FR-38) writes the same line again
        -- rather than a second one: a line has no natural key — two gas meters at one site are two lines. Unique
        -- per organization rather than globally, so an id one tenant chose can never collide with another's, and a
        -- conflict is only ever with the bound tenant's own row.
        id                   uuid        NOT NULL,
        organization_id      uuid        NOT NULL,
        report_id            uuid        NOT NULL,

        -- The report's B1 site row (see the header). Never negative, as an ordinal is never negative.
        site_ordinal         int         NOT NULL,
        -- A key of the factor set the report's period resolves (task 37.1) — checked by the use case, since the set
        -- is configuration and a CHECK here would be frozen history the day a source is added.
        source_key           text        NOT NULL,
        -- The reporter's own name for the line — "the van", "oven and boiler". Optional.
        description          text,

        -- The figure on the invoice, in the unit it reads in (FR-33). numeric, never float (§7.9).
        quantity             numeric,
        unit_code            text,
        -- Or why there is no figure — "billed by the landlord". A line is one or the other.
        not_available_reason text,

        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),

        PRIMARY KEY (organization_id, id),

        CONSTRAINT calc_source_site_ordinal_non_negative CHECK (site_ordinal >= 0),
        CONSTRAINT calc_source_quantity_non_negative CHECK (quantity >= 0),
        -- A quantity and its unit, or a reason and neither: a figure with no unit means nothing, and a line that is
        -- both measured and unavailable is a contradiction the report would print.
        CONSTRAINT calc_source_measured_or_explained CHECK (
          (quantity IS NOT NULL AND unit_code IS NOT NULL AND not_available_reason IS NULL)
          OR (quantity IS NULL AND unit_code IS NULL AND not_available_reason IS NOT NULL)
        ),

        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    // Every read is one report's lines; the key leads with the tenant for AD-2, then the report.
    await queryRunner.query(`
      CREATE INDEX calc_source_report_idx ON core.calc_source (organization_id, report_id)
    `);

    await queryRunner.query(`
      CREATE TABLE core.calc_run (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        report_id           uuid        NOT NULL,

        -- FR-35's pin: the factor set's country and its revision, which is immutable and unique per country
        -- (task 37.2). The label an operator gave the set is read back through the pin, never copied.
        factor_set_country  text        NOT NULL,
        factor_set_revision int         NOT NULL,

        recorded_at         timestamptz NOT NULL DEFAULT now(),
        -- Who ran it, from the request's own binding rather than a parameter, as core.field_change attributes —
        -- so a caller cannot name someone else. Null where nothing is bound, which no route allows.
        recorded_by         uuid        DEFAULT NULLIF(current_setting('app.current_user', true), '')::uuid,

        CONSTRAINT calc_run_factor_set_country_scope CHECK (factor_set_country ~ '^[a-z]{2}$'),
        CONSTRAINT calc_run_factor_set_revision_positive CHECK (factor_set_revision > 0),

        FOREIGN KEY (report_id, organization_id) REFERENCES core.report (id, organization_id),
        -- The target an input names, so an input cannot be tied to one report's run and another report.
        UNIQUE (id, report_id, organization_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX calc_run_report_idx ON core.calc_run (organization_id, report_id, recorded_at)
    `);

    await queryRunner.query(`
      CREATE TABLE core.calc_input (
        id                   uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id      uuid        NOT NULL,
        report_id            uuid        NOT NULL,
        run_id               uuid        NOT NULL,

        -- The line this was copied from, as provenance and not as a key: the line may be edited or removed after
        -- the run, and this row is what it was when the run read it.
        source_id            uuid        NOT NULL,
        site_ordinal         int         NOT NULL,
        source_key           text        NOT NULL,
        description          text,
        quantity             numeric,
        unit_code            text,
        not_available_reason text,

        FOREIGN KEY (run_id, report_id, organization_id)
          REFERENCES core.calc_run (id, report_id, organization_id),
        FOREIGN KEY (report_id, organization_id) REFERENCES core.report (id, organization_id),
        UNIQUE (run_id, source_id)
      )
    `);

    // ── Grants ───────────────────────────────────────────────────────────────────────────────────────────────
    //
    // The working set: written, edited and removed by the request tier, but a line never moves to another report or
    // tenant — those are its identity, so `UPDATE` is granted on what a person edits and nothing else.
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON core.calc_source TO esg_app`);
    await queryRunner.query(`
      GRANT UPDATE (site_ordinal, source_key, description, quantity, unit_code, not_available_reason, updated_at)
        ON core.calc_source TO esg_app
    `);
    // The runs: inserted and read, never changed.
    await queryRunner.query(`GRANT SELECT, INSERT ON core.calc_run, core.calc_input TO esg_app`);
    await queryRunner.query(`
      GRANT SELECT ON core.calc_source, core.calc_run, core.calc_input TO esg_worker, esg_admin_ro
    `);

    // ── Row-level security, every table ──────────────────────────────────────────────────────────────────────
    for (const table of ['calc_source', 'calc_run', 'calc_input']) {
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
    }
    // Only the working set is updated or deleted, so only it carries those policies — a run table with no UPDATE or
    // DELETE policy refuses both even to a role that somehow held the privilege.
    await queryRunner.query(`
      CREATE POLICY calc_source_tenant_update ON core.calc_source
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY calc_source_tenant_delete ON core.calc_source
        FOR DELETE USING (organization_id = ${this.boundOrganization})
    `);

    // ── FR-22's lock, on all three (task 31.4's invariant) ─────────────────────────────────────────────────────
    //
    // The disclosure store's function, unchanged: it reads `report_id` off the row, which each table carries. A line
    // edited, a run recorded or an input copied while the period is locked would move a filed figure's basis.
    for (const table of ['calc_source', 'calc_run', 'calc_input']) {
      await queryRunner.query(`
        CREATE TRIGGER refuse_locked_write
          BEFORE INSERT OR UPDATE OR DELETE ON core.${table}
          FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
      `);
    }

    // FR-54's per-field capture, on the working set only. A line is a number a person typed that moves a figure a
    // filing carries; the two run tables are immutable records of what a run read, and a trail of them would record
    // the writing of a record.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.calc_source
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.calc_input`);
    await queryRunner.query(`DROP TABLE core.calc_run`);
    await queryRunner.query(`DROP TABLE core.calc_source`);
  }
}

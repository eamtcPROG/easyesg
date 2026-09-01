import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-24 … FR-32 and FR-54 — the generic disclosure value store (task 34.1; §7.3, AD-3, T-3).
 *
 * **One table for every disclosure of every module of every taxonomy version.** No table per module
 * and no column per element: the element is a VSME XBRL local name in `element_key`, its axis member
 * in `dimension_key`, and its position in a repeating group in `ordinal`. That is AD-3, and T-3
 * accepts what it costs — compile-time typing and per-disclosure check constraints — because DDL per
 * taxonomy release is not viable for a standard that has already shipped one breaking change. Task
 * 34.2's generated facade is where the typing is bought back.
 *
 * **The primary key is a surrogate and the natural key is a `UNIQUE` beside it** (§7.3, amended
 * 1 Sep 2026 by this task with the project owner). §7.3 first specified
 * `PRIMARY KEY (report_id, element_key, dimension_key, ordinal)` and no `id`, justified by
 * `FIELD_CHANGE` needing an FK target — and task 14 built `core.field_change` as a *generic* trail
 * keyed by `(table_name, record_id)` with no foreign key to anything. What it actually needs is a
 * single `uuid` readable as `to_jsonb(NEW) ->> 'id'`, because `record_id` is `uuid NOT NULL`; against
 * the composite key the capture trigger would have raised a not-null violation on **every write**.
 * FR-54's acceptance criterion names *"any disclosure field"*, so this is the table the per-field
 * trail exists for and exempting it was never available.
 *
 * **`state` is `text` with a `CHECK`, not a PostgreSQL enum**, following `core.report.status` one
 * task earlier. §7.3 writes it `core.disclosure_state`, which names the vocabulary rather than
 * mandating a type: CLAUDE.md makes the `CHECK` constraint the database's own copy of a closed
 * vocabulary and an `as const` its mirror, and `identity.encrypted_secret` is a domain because it
 * makes plaintext unrepresentable, which a state list does not do.
 */
export class ReportDisclosureValue1789344000000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.report_disclosure_value (
        id                   uuid    NOT NULL DEFAULT uuidv7(),

        report_id            uuid    NOT NULL,
        organization_id      uuid    NOT NULL,

        -- The VSME XBRL element local name, e.g. EnergyConsumptionFromFuels. Deliberately NOT a
        -- foreign key into a taxonomy table: the taxonomy is configuration read from the store
        -- (AD-4, task 33.1), not schema, which is the whole of what AD-3 buys. A key the registered
        -- version does not carry is refused by the application against the registry, and task 34.2's
        -- facade makes it unreachable from typed code.
        element_key          text    NOT NULL,

        -- An axis member: energy, pollutant, waste, country of employment, reporting scope. NOT NULL
        -- with an empty default so the natural key below is a plain composite — PostgreSQL accepts
        -- no expression in a UNIQUE constraint, so nullable-with-COALESCE would leave the natural
        -- key unenforceable by a constraint at all (§7.3).
        dimension_key        text    NOT NULL DEFAULT '',

        -- Position within a repeating group: sites, subsidiaries, materials.
        ordinal              int     NOT NULL DEFAULT 0,

        -- numeric, never float. A double cannot represent 0.1 and these values are summed into
        -- emissions figures a filing carries (§7.3).
        value_numeric        numeric,
        value_text           text,
        value_boolean        boolean,
        value_date           date,

        -- MWh, tCO2e, m3, headcount, FTE. Which units an element admits is the taxonomy's business,
        -- so this is unconstrained here and validated against the registry.
        unit_code            text,

        -- FR-40's five validation states verbatim — OK, MISSING VALUE, VALUE INCONSISTENCY, ERROR,
        -- INVALID URL — plus the three that are answers rather than verdicts: FR-30's nil return,
        -- FR-31's not material and FR-32/D-4's not available with a reason. Each is distinct from an
        -- absent row, because the model has to say "answered zero" and "deliberately unanswered,
        -- because X" differently (§7.3).
        state                text    NOT NULL,
        not_available_reason text,

        -- FR-47, not FR-46: FR-46 is *displaying* last year's value beside this year's input, and
        -- this column is the other requirement — a prior value carried forward and MARKED, "so that
        -- it is reviewed rather than accumulating unnoticed" (UC-46 step 2 is the marking).
        carried_forward      boolean NOT NULL DEFAULT false,

        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),

        PRIMARY KEY (id),

        -- The natural key. One value per element per dimension member per ordinal per report.
        UNIQUE (report_id, element_key, dimension_key, ordinal),

        CONSTRAINT report_disclosure_value_state_known
          CHECK (state IN ('ok', 'missing', 'inconsistency', 'error', 'invalid_url',
                           'not_available', 'not_material', 'nil_return')),

        -- FR-32 and D-4: the reason is what makes "not available" a disclosure rather than a gap,
        -- so the state cannot be claimed without one, and no other state may carry one.
        CONSTRAINT report_disclosure_value_reason_matches_state
          CHECK ((state = 'not_available') = (not_available_reason IS NOT NULL)),

        -- organization_id is TIED to the report's rather than merely copied: core.report carries
        -- UNIQUE (id, organization_id) for this composite reference. Without it a wrong tenant id
        -- hides a row from its own tenant or exposes it to another, and RLS faithfully enforces
        -- whatever the column says (§7.3). CASCADE because the chain above already cascades —
        -- organization to period to report — and a report that no longer exists has no values.
        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    // §7.3 prescribes an index leading with organization_id, "since every RLS-filtered scan
    // predicates on it". **Measured rather than assumed (task 34.1), and the measurement narrows
    // the claim**: neither read this adapter issues uses this index. `EXPLAIN` under `esg_app` with
    // a bound tenant and `enable_seqscan = off` plans both `forReport` and `find` as an Index Scan
    // on the natural-key UNIQUE — which leads with report_id and also satisfies `forReport`'s ORDER
    // BY without a Sort — and applies RLS's organization_id as a *Filter*, not an Index Cond. That
    // is the right plan: report_id is already highly selective, so filtering the handful of rows it
    // returns costs nothing.
    //
    // So this index is **reachable and currently unread**: a bare `WHERE organization_id = …` does
    // plan onto it, and the tenant-wide scans that will issue one are the export (task 44/46) and a
    // validation run (task 40), neither of which exists. It ships because §7.3 prescribes it and
    // because adding an index to the highest-volume table in the system later is a migration over
    // live rows — but the write cost is real and unpaid-for today, which is stated here rather than
    // discovered by whoever measures this table under load.
    await queryRunner.query(`
      CREATE INDEX report_disclosure_value_tenant_idx
        ON core.report_disclosure_value (organization_id, report_id, element_key)
    `);

    // ── Grants: DR-6's mechanism narrowed to columns, as task 31.3 did for the pin ──────────────
    //
    // The application writes values; it does not move a row between reports, elements, dimensions
    // or ordinals. Those six columns are the row's IDENTITY, and a row that changed them would be a
    // different disclosure wearing an old row's audit trail — which is precisely what FR-54's trail
    // is supposed to make impossible to do quietly. Withholding UPDATE makes it unreachable from the
    // request tier rather than merely unwritten in a repository.
    await queryRunner.query(
      `GRANT SELECT, INSERT, DELETE ON core.report_disclosure_value TO esg_app`,
    );
    await queryRunner.query(`
      GRANT UPDATE (value_numeric, value_text, value_boolean, value_date, unit_code,
                    state, not_available_reason, carried_forward, updated_at)
        ON core.report_disclosure_value TO esg_app
    `);
    await queryRunner.query(
      `GRANT SELECT ON core.report_disclosure_value TO esg_worker, esg_admin_ro`,
    );

    await queryRunner.query(`ALTER TABLE core.report_disclosure_value ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.report_disclosure_value FORCE ROW LEVEL SECURITY`);
    for (const statement of [
      `CREATE POLICY report_disclosure_value_tenant_select ON core.report_disclosure_value
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_disclosure_value_tenant_insert ON core.report_disclosure_value
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_disclosure_value_tenant_update ON core.report_disclosure_value
         FOR UPDATE USING (organization_id = ${this.boundOrganization})
                 WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_disclosure_value_tenant_delete ON core.report_disclosure_value
         FOR DELETE USING (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // ── FR-22's lock, reaching the values ──────────────────────────────────────────────────────
    //
    // Task 31.4's invariant requires every tenant table with a foreign key into core.report or
    // core.reporting_period to carry this trigger or be declared exempt — built so that this table
    // could not ship inside a lock without one. The lock lives on the parent, so the guard reads it
    // there rather than comparing row images the way core.report's own guard does.
    await queryRunner.query(`
      CREATE FUNCTION core.refuse_locked_disclosure_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM core.report r
           WHERE r.id = NEW.report_id
             AND r.status = 'locked'
        ) THEN
          RAISE EXCEPTION 'report % is locked', NEW.report_id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    // INSERT and UPDATE here; **DELETE is added by `1789430400000-locked-disclosure-delete.ts`**,
    // which is where the reason lives. In short: this migration declined to cover DELETE by
    // inheriting task 31.2's finding that a BEFORE DELETE trigger fires during a referential
    // cascade — true of the period's guard, which reads its own `OLD.locked_at`, and false of this
    // one, which reads its parent and therefore cannot see a locked report once the cascade has
    // deleted it. Measured there rather than assumed here, which is what 34.1 failed to do.
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE INSERT OR UPDATE ON core.report_disclosure_value
        FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
    `);

    // FR-54's per-field capture, and the reason this table has a surrogate id at all. NFR-7 makes
    // attribution unretrofittable, so it is attached with the table rather than after it.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.report_disclosure_value
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.report_disclosure_value`);
    await queryRunner.query(`DROP FUNCTION core.refuse_locked_disclosure_write()`);
  }
}

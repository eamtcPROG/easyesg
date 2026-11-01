import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-21, FR-45 and FR-66 — the reporting period (task 31.1; UC-56).
 *
 * **The first table in the schema to carry legal dates**, which is why §7.9's `<field>` + `<field>_tz`
 * pairing exists and why `schema-invariants.e2e-spec.ts` has been carrying an unfired rule since
 * task 11 saying it "first bites in task 31". A period boundary is the exact case NFR-34 was written
 * for: *31 December 2026* is not an instant, and stored as one it lands in the wrong fiscal year for
 * a reader in another zone — an error FR-125 makes uncorrectable by editing.
 *
 * **The version pin is two columns and they are copied, never referenced.** DR-4 makes version a
 * dimension of the data model, so the period records the strings the taxonomy registry answered at
 * open; a foreign key into the configuration store would let a later publication move a pinned
 * report's meaning, which is precisely what FR-66 exists to prevent.
 */
export class ReportingPeriod1789084800000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.reporting_period (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        reporting_entity_id uuid        NOT NULL,

        -- FR-21 names the fiscal year alongside the dates rather than deriving it from them, and
        -- that is not redundancy: a fiscal year straddling two calendar years is labelled by the
        -- undertaking, not by arithmetic on its boundaries.
        fiscal_year         int         NOT NULL,

        -- NFR-34. A calendar date plus the IANA zone that determined it, per §7.9's convention.
        period_start        date        NOT NULL,
        period_start_tz     text        NOT NULL,
        period_end          date        NOT NULL,
        period_end_tz       text        NOT NULL,

        -- FR-21's optional due date: "the date by which the report must be complete, which is not
        -- the same as the period end" (UC-56 step 5), and what UC-170's deadline notices count down
        -- to. **No temporal constraint against period_end deliberately** — the requirement draws a
        -- conceptual distinction, not an ordering, and an undertaking setting an internal deadline
        -- before its own year end is doing something sensible that a greater-than check would refuse.
        due_date            date,
        due_date_tz         text,

        -- DR-4, FR-66. Copied values, not references — see the class header.
        template_version    text        NOT NULL,
        taxonomy_version    text        NOT NULL,

        -- FR-45's linkage. Maintained rather than merely set: creating a period repoints the
        -- neighbour that should now follow it, so a backfilled year does not leave its successor
        -- with a null prior forever (§12.5.6's task-31.1 row).
        prior_period_id     uuid,

        -- FR-18's point-in-time master data, taken at period open. On the period rather than on the
        -- report, because period open is the determining event (§7.2 as amended, §12.5.6).
        entity_snapshot_id  uuid,

        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT reporting_period_dates_ordered CHECK (period_end >= period_start),
        -- A date with no zone is the defect NFR-34 names; the gate checks the columns exist, this
        -- checks a row cannot carry one without the other.
        CONSTRAINT reporting_period_due_date_paired
          CHECK ((due_date IS NULL) = (due_date_tz IS NULL)),
        -- Shape only. A zone is admitted against the IANA database in the application, which the
        -- database cannot do in a CHECK — pg_timezone_names is a view and a CHECK must be
        -- immutable.
        CONSTRAINT reporting_period_zones_named CHECK (
          period_start_tz <> '' AND period_end_tz <> '' AND (due_date_tz IS NULL OR due_date_tz <> '')
        ),
        -- A period cannot precede itself. The self-reference is otherwise unconstrained in depth,
        -- which is correct: the chain is as long as the entity has years.
        CONSTRAINT reporting_period_prior_is_not_self CHECK (prior_period_id <> id),

        FOREIGN KEY (reporting_entity_id, organization_id)
          REFERENCES core.reporting_entity (id, organization_id) ON DELETE CASCADE,
        FOREIGN KEY (prior_period_id, organization_id)
          REFERENCES core.reporting_period (id, organization_id) ON DELETE SET NULL,
        FOREIGN KEY (entity_snapshot_id, organization_id)
          REFERENCES core.entity_snapshot (id, organization_id),

        -- §7.3's composite-FK target, for task 31.3's report.
        UNIQUE (id, organization_id)
      )
    `);

    // **Two periods for one entity may not overlap** (§12.5.6's task-31.1 row). `btree_gist` has
    // been installed since task 11's baseline for exactly this: it is what lets a `uuid` equality
    // operator share a GiST index with a range overlap operator.
    //
    // The bound is `'[]'` — inclusive at both ends — because `period_end` is the last day *in* the
    // period, not the first day after it. With the default `'[)'` a year ending 31 Dec and the next
    // starting 1 Jan would be read as adjacent when in fact they are, and a year ending 31 Dec
    // followed by one *also* containing 31 Dec would not be caught.
    //
    // Deliberately no `UNIQUE (reporting_entity_id, fiscal_year)`: an undertaking changing its
    // fiscal year end produces a short transition period and a new full one that can carry the same
    // year label without overlapping.
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        ADD CONSTRAINT reporting_period_no_overlap
        EXCLUDE USING gist (
          reporting_entity_id WITH =,
          daterange(period_start, period_end, '[]') WITH &&
        )
    `);

    // The period list for an entity, newest first — S-14's index. Measured with
    // `enable_seqscan = off`: the list plan is an index scan on this with an incremental sort for
    // the `id` tiebreak.
    //
    // **The prior-period lookup does NOT read it, and needs no index of its own.** It orders by
    // `period_end` where this orders by `period_start`, so the planner reaches the entity's rows
    // through the exclusion constraint's own GiST index — `reporting_period_no_overlap` indexes
    // `reporting_entity_id` for the `WITH =` operand — and sorts the handful it finds. An entity
    // has a dozen periods in its lifetime; a third index to save that sort would cost every write
    // to save nothing measurable.
    await queryRunner.query(`
      CREATE INDEX reporting_period_entity_idx
        ON core.reporting_period (organization_id, reporting_entity_id, period_start DESC)
    `);
    // **This one is for the self-referencing foreign key, not for a query anyone writes** — measured
    // rather than assumed, and the first draft's comment claimed the wrong reader. The relink looks
    // periods up by entity and date, so it uses the index above; nothing in the application selects
    // on `prior_period_id` at all. What does is PostgreSQL itself: `ON DELETE SET NULL` has to find
    // every row referencing a period being removed, and a cascade from an entity removes them one by
    // one. Without this, each of those is a sequential scan.
    //
    // `EXPLAIN` with `enable_seqscan = off` confirms it is usable for that predicate, which is the
    // check `apps/api/CLAUDE.md` asks for: at these table sizes the planner prefers a scan anyway,
    // so "is it used today" is the wrong question and "is it usable" is the right one.
    await queryRunner.query(`
      CREATE INDEX reporting_period_prior_idx
        ON core.reporting_period (organization_id, prior_period_id)
        WHERE prior_period_id IS NOT NULL
    `);

    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON core.reporting_period TO esg_app
    `);
    await queryRunner.query(`
      GRANT SELECT ON core.reporting_period TO esg_worker, esg_admin_ro
    `);

    await queryRunner.query(`ALTER TABLE core.reporting_period ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.reporting_period FORCE ROW LEVEL SECURITY`);
    for (const statement of [
      `CREATE POLICY reporting_period_tenant_select ON core.reporting_period
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY reporting_period_tenant_insert ON core.reporting_period
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY reporting_period_tenant_update ON core.reporting_period
         FOR UPDATE USING (organization_id = ${this.boundOrganization})
                 WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY reporting_period_tenant_delete ON core.reporting_period
         FOR DELETE USING (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // FR-54's per-field capture. The version pins are the columns this matters most for: DR-4's
    // guarantee is that they never move silently, and the audit trail is what makes "silently"
    // checkable after the fact.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.reporting_period
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.reporting_period`);
  }
}

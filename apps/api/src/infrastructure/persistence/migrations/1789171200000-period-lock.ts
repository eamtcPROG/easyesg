import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-22 — locking a reporting period, and reopening it as a recorded amendment (task 31.2;
 * UC-57, UC-58).
 *
 * **The lock refuses every write, the administrator's included** (§12.5.6's task-31.2 row). UC-57
 * names the Reporting Contributor and FR-22's criterion followed it, which read as a role gate;
 * taken that way an administrator's correction lands in the trail as ordinary editing, against
 * UC-58's rule that an amendment must be visible as one. Reopening is the only route through the
 * lock, which is what makes it the defensible endpoint UC-57 describes.
 *
 * **Enforced here as well as in the use case, which is P-4 rather than belt and braces.** The
 * application check is what produces a message a person can act on; this trigger is what makes the
 * guarantee independent of every future writer remembering it — and it closes the read-then-lock
 * race that an application check alone cannot.
 */
export class PeriodLock1789171200000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // **`locked_by` carries no foreign key into `identity`, and that is two rules at once.** §7.1
    // permits exactly one cross-schema foreign key — `identity` → `core.organization` — and this
    // would have been a second, pointing the other way; the invariant gate caught it. It is also
    // what FR-55 wants: an `ON DELETE SET NULL` would erase the attribution on account deletion,
    // which is the opposite of *retain historical attribution*. `core.field_change.actor_id` set
    // this precedent at task 14 and says so in its own migration.
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        ADD COLUMN locked_at timestamptz,
        ADD COLUMN locked_by uuid
    `);

    // The lock is one fact, so the two columns move together. A one-way implication rather than an
    // equality, because a lock placed by a since-deleted account is still a lock.
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        ADD CONSTRAINT reporting_period_locked_by_needs_lock
        CHECK (locked_by IS NULL OR locked_at IS NOT NULL)
    `);

    // ── UC-58's record ─────────────────────────────────────────────────────────────────────────
    //
    // **A table rather than columns**, because columns hold only the most recent reopening and a
    // second one would silently overwrite the first — which is precisely the amendment history
    // UX-72 exists to keep (§12.5.6).
    //
    // **Immutable by grant**, following `core.entity_snapshot`: no runtime role holds UPDATE or
    // DELETE and there is no policy for either. A record of an amendment that could itself be
    // amended is not a record.
    await queryRunner.query(`
      CREATE TABLE core.period_reopening (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        reporting_period_id uuid        NOT NULL,
        -- The lock this reopening ended, so the record states the whole amendment rather than only
        -- its second half. Not null: a reopening without a lock is not representable.
        locked_at           timestamptz NOT NULL,
        reopened_at         timestamptz NOT NULL DEFAULT now(),
        -- No foreign key, for the reason stated on locked_by above: §7.1's single permitted
        -- cross-schema reference, and FR-55's requirement that attribution outlive the account.
        reopened_by         uuid,
        reason              text        NOT NULL,

        -- UX-72 requires the reason to be stated and displayed. An empty one would satisfy a NOT
        -- NULL and defeat the requirement, which is what this refuses.
        CONSTRAINT period_reopening_reason_stated CHECK (btrim(reason) <> ''),

        FOREIGN KEY (reporting_period_id, organization_id)
          REFERENCES core.reporting_period (id, organization_id) ON DELETE CASCADE,
        UNIQUE (id, organization_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX period_reopening_period_idx
        ON core.period_reopening (organization_id, reporting_period_id, reopened_at DESC)
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON core.period_reopening TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON core.period_reopening TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.period_reopening ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.period_reopening FORCE ROW LEVEL SECURITY`);
    for (const statement of [
      `CREATE POLICY period_reopening_tenant_select ON core.period_reopening
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY period_reopening_tenant_insert ON core.period_reopening
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // ── The guarantee, below the application (P-4) ─────────────────────────────────────────────
    //
    // A locked row admits exactly one write: the one that clears the lock. Everything else — a date
    // edit, a second lock, a delete — is refused here whatever the caller believes.
    //
    // SQLSTATE `45001` is in class 45, which the standard leaves to applications, so the repository
    // can recognise this specific refusal and answer it as a domain conflict rather than as a 500.
    // `raise_exception` (P0001) would have made every plpgsql error in the schema look the same.
    //
    // **The permitted write must change nothing but the lock**, which is the half a first version
    // of this trigger missed: `NEW.locked_at IS NULL` alone would admit a single statement that
    // cleared the lock *and* moved the period's dates, so "reopening is the only route through the
    // lock" would have been true of the statement and false of the data. Comparing the row images
    // with the three lock-and-bookkeeping keys removed is what closes it, and it needs no column
    // list — a column added later is covered the day it is added.
    await queryRunner.query(`
      CREATE FUNCTION core.refuse_locked_period_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.locked_at IS NOT NULL
           OR (to_jsonb(NEW) - 'locked_at' - 'locked_by' - 'updated_at')
              IS DISTINCT FROM
              (to_jsonb(OLD) - 'locked_at' - 'locked_by' - 'updated_at') THEN
          RAISE EXCEPTION 'reporting period % is locked', OLD.id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    // **UPDATE only, and DELETE deliberately not** — the first version of this trigger covered both,
    // and covering DELETE was wrong twice over.
    //
    // It is not what FR-22 asks for: the requirement is that a locked period is *read-only* and that
    // an amendment is visible as one, and a row that ceases to exist has not been amended. The
    // change history the lock defends lives in core.field_change, whose record_id carries no foreign
    // key precisely so the trail outlives the row — so a deletion cannot reach that endpoint, while
    // a silent UPDATE could.
    //
    // And it broke a flow nothing in this task touches: core.reporting_period is reached by
    // ON DELETE CASCADE from the entity and from the organization, so one locked period made its
    // **organization** undeletable, failing with a plpgsql error raised three tables from the
    // statement that caused it. Removing a tenant is an erasure of the whole context, not an
    // amendment of a filing.
    //
    // `WHEN (OLD.locked_at IS NOT NULL)` keeps the function out of the path entirely for the
    // ordinary case, which is every write to every unlocked period.
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE UPDATE ON core.reporting_period
        FOR EACH ROW WHEN (OLD.locked_at IS NOT NULL)
        EXECUTE FUNCTION core.refuse_locked_period_write()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER refuse_locked_write ON core.reporting_period`);
    await queryRunner.query(`DROP FUNCTION core.refuse_locked_period_write()`);
    await queryRunner.query(`DROP TABLE core.period_reopening`);
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        DROP CONSTRAINT reporting_period_locked_by_needs_lock,
        DROP COLUMN locked_by,
        DROP COLUMN locked_at
    `);
  }
}

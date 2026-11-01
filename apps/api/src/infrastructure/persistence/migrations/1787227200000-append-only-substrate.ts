import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The append-only substrate (DR-6, NFR-33, §7.7).
 *
 * NFR-33 requires audit and ledger records to be append-only **at database privilege level**, with
 * the stated verification that attempted mutation fails at the store rather than in application
 * code. The point is that no application path — present or future, careful or not — can rewrite
 * history; corrections are superseding entries referencing the original (FR-151, D-10).
 *
 * §7.7 names the two load-bearing statements, and they are not the `GRANT`: the blanket `REVOKE
 * ... FROM PUBLIC` and `ALTER DEFAULT PRIVILEGES`. Revoking `UPDATE, DELETE` from a role that was
 * only ever granted `INSERT, SELECT` is a no-op; the realistic failure is an ORM bootstrap or a
 * well-meaning operator having issued `GRANT ALL ON ALL TABLES IN SCHEMA audit`.
 *
 * **Partitioning is required here, not optional.** §15 names "a partitioning plan gate for every
 * append-only store", and §12.5.7 sets 24-month retention on system audit and metering while
 * `DELETE` is denied — so pruning can only be `DETACH PARTITION` + `DROP TABLE`, which triggers do
 * not block. Converting a populated table later means a rewrite under `ACCESS EXCLUSIVE`, which
 * NFR-48 forbids inside the filing window, on a table that would by then hold six-year billing
 * audit. Partitioning at creation is the cheap end of an asymmetric trade.
 *
 * **Partitioning also opens two holes that §7.7 could not have anticipated, both verified against
 * PostgreSQL 18 rather than assumed:**
 *
 *  1. A `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger on the parent does **not** propagate to
 *     partitions. `TRUNCATE audit.system_audit_log_2026` succeeds where `TRUNCATE` on the parent is
 *     refused — the very hole §7.7 calls "the fastest way to lose a ledger", reopened. The row
 *     trigger *does* propagate, so `UPDATE`/`DELETE` are covered either way.
 *  2. RLS on the parent does **not** propagate either: a partition reads `relrowsecurity = false`,
 *     and a role holding a direct grant on it sees every tenant's rows.
 *
 * Both are closed the same way — the procedure below seals every partition individually — and the
 * schema-invariant gate asserts it stays true, because the next partition is added by a task that
 * will not be reading this comment.
 */
export class AppendOnlySubstrate1787227200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // §7.7's default-deny posture for the schema as a whole. `audit` is NOT uniformly append-only —
    // §7.10 also puts `outbox_event` and `inbound_event` here, and AD-6's dispatcher must mark an
    // outbox row dispatched, which is an UPDATE. So the schema denies by default and each table
    // states its own grant; append-only is a per-table property, asserted per table by the gate.
    await queryRunner.query(`
      REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC, esg_app, esg_worker
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON TABLES FROM esg_app, esg_worker
    `);

    // The message is developer-facing and stays untranslated on purpose: it reaches a log or a
    // stack trace, never a screen. ProblemDetailsFilter resolves the `title`/`detail` a person
    // reads from the catalogue, so the no-internal-identifiers rule is satisfied where it binds.
    await queryRunner.query(`
      CREATE FUNCTION audit.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        RAISE EXCEPTION
          'append-only: % permits INSERT only; corrections are superseding rows', TG_TABLE_NAME;
      END
      $fn$
    `);

    // One procedure so tasks 61 (ledger), 62 (metering) and 67 (support access) apply the whole
    // pattern rather than three quarters of it. Four parts, and omitting any one is silent:
    // the revoke, the row trigger, the statement trigger, and the per-partition sealing.
    await queryRunner.query(`
      CREATE PROCEDURE audit.enforce_append_only(target regclass) LANGUAGE plpgsql AS $proc$
      DECLARE
        part regclass;
      BEGIN
        EXECUTE format(
          'REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM PUBLIC, esg_app, esg_worker', target);

        EXECUTE format('CREATE TRIGGER no_mutate BEFORE UPDATE OR DELETE ON %s '
                       'FOR EACH ROW EXECUTE FUNCTION audit.reject_mutation()', target);
        EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON %s '
                       'FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation()', target);

        -- Each partition, individually. The row trigger is cloned onto partitions by PostgreSQL;
        -- the TRUNCATE trigger is not, and neither is RLS. A partition is a storage detail the
        -- application never names, so enabling RLS on it with NO policy is exactly right: it
        -- denies direct access outright while queries through the parent keep using the parent's
        -- policies. Verified: parent SELECT returns the tenant's row, direct partition SELECT
        -- returns none.
        FOR part IN SELECT inhrelid::regclass FROM pg_inherits WHERE inhparent = target
        LOOP
          EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, esg_app, esg_worker', part);
          EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON %s '
                         'FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_mutation()', part);
          EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part);
          EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', part);
        END LOOP;
      END
      $proc$
    `);

    // FR-159: every state-changing action attributed to an actor with a timestamp. The columns are
    // the minimum that is true; task 14 owns the audit service and extends them by
    // expand -> migrate -> contract. `organization_id` is NOT NULL deliberately — starting scoped
    // and relaxing later is the safe direction, and whether platform-level events belong here or in
    // task 67's support_access_log is task 14's question, not one to pre-empt with a nullable column.
    //
    // The primary key carries `occurred_at` because PostgreSQL requires a unique constraint on a
    // partitioned table to include every partitioning column. That is a consequence of the
    // partitioning decision, not a modelling choice.
    await queryRunner.query(`
      CREATE TABLE audit.system_audit_log (
        id              uuid        NOT NULL DEFAULT uuidv7(),
        occurred_at     timestamptz NOT NULL DEFAULT now(),
        organization_id uuid        NOT NULL,
        actor_id        uuid,
        action          text        NOT NULL,
        PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at)
    `);

    // Pre-created through 2028, plus a default so an audit write can never fail for want of a
    // partition — losing the record of an action is worse than storing it in the wrong place, and
    // §12.5.7's 24-month retention means the default should still be empty when a scheduled job
    // takes over partition creation.
    for (const year of [2026, 2027, 2028]) {
      await queryRunner.query(`
        CREATE TABLE audit.system_audit_log_${year} PARTITION OF audit.system_audit_log
          FOR VALUES FROM ('${year}-01-01 00:00:00+00') TO ('${year + 1}-01-01 00:00:00+00')
      `);
    }
    await queryRunner.query(`
      CREATE TABLE audit.system_audit_log_default PARTITION OF audit.system_audit_log DEFAULT
    `);

    // On the parent only. A routed INSERT is privilege-checked against the parent, so the
    // application never needs — and must never hold — a grant on a partition.
    await queryRunner.query(`
      GRANT INSERT, SELECT ON audit.system_audit_log TO esg_app, esg_worker
    `);
    await queryRunner.query(`GRANT SELECT ON audit.system_audit_log TO esg_admin_ro`);

    // Tenant-scoped like every other table carrying organization_id (AD-2). No permissive INSERT
    // exception here: the tenant root has one because FR-13 must create an organization before a
    // context can exist, and nothing analogous applies to writing an audit row.
    const boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;
    await queryRunner.query(`ALTER TABLE audit.system_audit_log ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audit.system_audit_log FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY system_audit_log_tenant_select ON audit.system_audit_log
        FOR SELECT USING (organization_id = ${boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY system_audit_log_tenant_insert ON audit.system_audit_log
        FOR INSERT WITH CHECK (organization_id = ${boundOrganization})
    `);

    // Last, so the partitions above are all present for the loop to seal.
    await queryRunner.query(`CALL audit.enforce_append_only('audit.system_audit_log')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the table takes its partitions, triggers, policies and grants with it.
    await queryRunner.query(`DROP TABLE audit.system_audit_log`);
    await queryRunner.query(`DROP PROCEDURE audit.enforce_append_only(regclass)`);
    await queryRunner.query(`DROP FUNCTION audit.reject_mutation()`);

    // The two schema-wide statements in `up` are deliberately NOT reversed. Their prior state was
    // "no grants at all" — PostgreSQL gives a new table nothing but owner privileges — so the
    // REVOKEs were defensive no-ops against a `GRANT ALL` someone might have issued. Reversing
    // them with a matching GRANT would not restore the old state; it would create a broader one,
    // leaving every future audit table writable by the application on the strength of a rollback.
  }
}

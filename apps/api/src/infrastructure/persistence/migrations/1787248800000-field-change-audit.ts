import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-field audit capture (P-11, FR-54, FR-55, FR-159).
 *
 * FR-54 requires, per field, who changed a value, when, and what the previous value was — and
 * NFR-7 explains why it is built now rather than when disclosures arrive: it supports a future
 * limited-assurance review, and retrofitting attribution is not possible. A trail with unknown
 * gaps is not evidence.
 *
 * **Capture is a trigger, and AD-14 constraint 5 is amended to say so.** That constraint reads
 * "the field-change path uses `queryRunner.query()`", and §12.3 argues for `RETURNING old.*,
 * new.*` on the grounds that PostgreSQL 17 needed a read-then-write under a lock. Both arguments
 * are about the *application* path — the query builder cannot express `RETURNING old.*`, and 17's
 * pattern cost a round trip. **Neither argues against a trigger, which was never considered and
 * never needed a read at all.** The deciding property is that a function must be called: a plain
 * `UPDATE` written in task 34 or 36 would bypass it silently, which is the application-discipline
 * failure DR-6 rejects for append-only records of exactly this kind. P-4 already places RLS,
 * gapless numbering and append-only below the application deliberately; this belongs with them.
 *
 * **The capture function is `SECURITY DEFINER`, which is the other half.** It runs as the owner,
 * so `esg_app` needs no `INSERT` on `core.field_change` — only `SELECT`. The application can
 * therefore read its audit trail and has no privilege by which to write, alter or forge one. An
 * `AFTER` trigger cannot be skipped and the row it writes cannot be authored by hand.
 */
export class FieldChangeAudit1787248800000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── FR-159's platform half, which task 13 deliberately left open ───────────────────────────
    //
    // FR-80's administrator account changes belong to no organization, so `organization_id` must
    // be nullable. Relaxing is the cheap direction; the reverse would not have been, which is why
    // task 13 started strict.
    //
    // Tenants cannot see these rows and it costs nothing to arrange: the existing SELECT policy
    // reads `organization_id = <bound>`, and NULL never equals anything. They are visible through
    // `esg_admin_ro`'s BYPASSRLS path (§7.6), which is what the administrative console uses.
    await queryRunner.query(`
      ALTER TABLE audit.system_audit_log ALTER COLUMN organization_id DROP NOT NULL
    `);

    // A platform row may only be written by a request that is NOT acting for a tenant. That is a
    // real structural distinction rather than a naming convention — the administrative realm has
    // no active organization (AD-2, D-5) — and it stops a tenant request forging platform-level
    // audit entries, which a bare `organization_id IS NULL` policy would permit since permissive
    // policies are OR'd. Task 67 may tighten it further with a realm setting once AdminRealmGuard
    // exists; it cannot loosen it.
    await queryRunner.query(`
      CREATE POLICY system_audit_log_platform_insert ON audit.system_audit_log
        FOR INSERT WITH CHECK (organization_id IS NULL AND ${this.boundOrganization} IS NULL)
    `);

    // ── core.field_change ─────────────────────────────────────────────────────────────────────
    //
    // §7.10 places it in `core`: it is tenant data, scoped by the same RLS as the rows it
    // describes. Partitioned on the same reasoning as task 13 — §15 requires a partitioning plan
    // for every append-only store, and this is the highest-volume one in the system, since
    // autosave (NFR-38) writes disclosure values continuously.
    //
    // `actor_id` carries no foreign key, and that is FR-55 rather than an omission: historical
    // attribution must survive the removal of a member's access, so the audit row cannot depend on
    // the account row still existing.
    //
    // Values are `text` because a field change is a record of what was displayed and replaced, not
    // a typed value to compute with. The typed value lives in the row the change describes.
    await queryRunner.query(`
      CREATE TABLE core.field_change (
        id              uuid        NOT NULL DEFAULT uuidv7(),
        occurred_at     timestamptz NOT NULL DEFAULT now(),
        organization_id uuid        NOT NULL,
        actor_id        uuid,
        table_name      text        NOT NULL,
        record_id       uuid        NOT NULL,
        field_name      text        NOT NULL,
        old_value       text,
        new_value       text,
        operation       text        NOT NULL,
        PRIMARY KEY (id, occurred_at)
      ) PARTITION BY RANGE (occurred_at)
    `);
    for (const year of [2026, 2027, 2028]) {
      await queryRunner.query(`
        CREATE TABLE core.field_change_${year} PARTITION OF core.field_change
          FOR VALUES FROM ('${year}-01-01 00:00:00+00') TO ('${year + 1}-01-01 00:00:00+00')
      `);
    }
    await queryRunner.query(`
      CREATE TABLE core.field_change_default PARTITION OF core.field_change DEFAULT
    `);

    await queryRunner.query(`
      CREATE INDEX field_change_record_idx
        ON core.field_change (organization_id, table_name, record_id, occurred_at DESC)
    `);

    // SELECT only. There is deliberately no INSERT grant: the capture trigger is SECURITY DEFINER
    // and writes as the owner, so the application can read its trail and has no means to write one.
    await queryRunner.query(`GRANT SELECT ON core.field_change TO esg_app, esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.field_change ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.field_change FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY field_change_tenant_select ON core.field_change
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    // It is `WITH CHECK (true)`, and unusually that is the tighter option here. On every other
    // table the INSERT policy is what stops a tenant writing another tenant's row; on this one the
    // grant already does, because no application role holds INSERT and the sole writer is the
    // SECURITY DEFINER trigger below, which can only record what actually happened.
    //
    // Scoping it to the bound organization instead breaks FR-13, and did: creating an organization
    // happens before any tenant context can exist — which is why core.organization carries a
    // permissive INSERT policy — so the capture of that very creation was refused and the insert
    // failed with it. The trigger runs as the owner and FORCE subjects the owner to policy too, so
    // some permitting policy has to exist or the capture writes nothing at all.
    await queryRunner.query(`
      CREATE POLICY field_change_capture_insert ON core.field_change FOR INSERT WITH CHECK (true)
    `);

    // ── The capture function ──────────────────────────────────────────────────────────────────
    //
    // One function for every audited table, comparing the row images as `jsonb` so it needs no
    // knowledge of any table's columns — which is what lets task 34's disclosure store attach to
    // it without a line of new plpgsql.
    //
    // TG_ARGV[0] names the column holding the tenant, because the tenant root is scoped by its own
    // `id` while every other tenant table carries `organization_id` (AD-2, as amended by task 12).
    // TG_ARGV[1..] are columns to ignore — `updated_at` changes on every write and recording it
    // would double the volume of the highest-volume table in the system to say nothing.
    //
    // `SET search_path` is not decoration on a SECURITY DEFINER function: without it the caller
    // controls name resolution and can shadow `core.field_change` with their own table.
    await queryRunner.query(`
      CREATE FUNCTION core.capture_field_change() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, core AS $fn$
      DECLARE
        before  jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
        after   jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
        tenant  uuid  := coalesce(after ->> TG_ARGV[0], before ->> TG_ARGV[0])::uuid;
        subject uuid  := coalesce(after ->> 'id', before ->> 'id')::uuid;
        actor   uuid  := NULLIF(current_setting('app.current_user', true), '')::uuid;
        field   text;
      BEGIN
        -- The union of both images, so a column present in only one of them is still compared.
        -- jsonb_object_keys, not akeys(hstore(...)): hstore is not installed, and a plpgsql body
        -- is not validated at creation, so that mistake surfaces on the first write rather than
        -- in the migration that introduced it.
        FOR field IN SELECT jsonb_object_keys(before || after)
        LOOP
          CONTINUE WHEN field = ANY (TG_ARGV[1:]);
          CONTINUE WHEN (before -> field) IS NOT DISTINCT FROM (after -> field);

          INSERT INTO core.field_change
            (organization_id, actor_id, table_name, record_id, field_name,
             old_value, new_value, operation)
          VALUES
            (tenant, actor, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, subject, field,
             before ->> field, after ->> field, TG_OP);
        END LOOP;

        RETURN NULL;
      END
      $fn$
    `);

    // AFTER, so the row it describes is the row that was actually written — a BEFORE trigger can
    // be followed by another that changes the value again. FOR EACH ROW, because per-field means
    // per row.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.organization
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('id', 'updated_at')
    `);

    // Append-only, by the same procedure and for the same reason as task 13's tables. The trail
    // that supports an assurance review must not be rewritable, including by the role that writes
    // it. Called last so the partitions above are all present to be sealed.
    await queryRunner.query(`CALL audit.enforce_append_only('core.field_change')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER capture_field_change ON core.organization`);
    await queryRunner.query(`DROP FUNCTION core.capture_field_change()`);
    await queryRunner.query(`DROP TABLE core.field_change`);
    await queryRunner.query(`
      DROP POLICY system_audit_log_platform_insert ON audit.system_audit_log
    `);
    await queryRunner.query(`
      ALTER TABLE audit.system_audit_log ALTER COLUMN organization_id SET NOT NULL
    `);
  }
}

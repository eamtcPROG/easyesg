import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.membership`, and the active organization on `identity.session` — FR-12, FR-56, FR-58,
 * FR-59, FR-60 (task 25.1).
 *
 * **The schema is `identity`, not `core`.** Task 25.1's row in `docs/task.md` said
 * `core.membership`; §7.1 lists memberships under `identity` and names exactly one permitted
 * cross-schema foreign key — "to `core.organization` only (membership target)" — which the
 * schema-invariant gate has encoded since task 9 and which task 19's migration already anticipated
 * in terms. The document governs and the tracking row was what was wrong; it has been corrected.
 *
 * This is the **first tenant-scoped table outside `core`**, so it is the first place two rules that
 * have so far been the same rule come apart: the schema-invariant gate scopes RLS by "`core.*` or
 * carries `organization_id`", and this table is the second clause's first real case.
 *
 * **The bootstrap problem, and the second SELECT policy that answers it.** Every tenant table so
 * far could scope every policy to `app.current_org`, because something else had already resolved
 * it. This one cannot: AD-2 grounds `app.current_org` in "the server-side membership lookup already
 * performed in `AuthGuard`", so the guard has to read this table *before* any tenant is bound. A
 * policy scoped only to the bound organization would make sign-in structurally impossible — the
 * lookup would return zero rows for everyone, forever, and present as "this account belongs to no
 * organization". `setTenantContext` already binds a second setting for `core.capture_field_change`
 * to attribute changes with, so the answer needs no new machinery: **an account may always read its
 * own membership rows**, which is FR-12 and UC-16 stated as a policy rather than as a query.
 *
 * That second policy grants **read only**, deliberately. Reading your own row in an organization
 * you are not acting for is UC-16's picker; writing it would be a member editing their own role in
 * an organization whose context they do not hold, which is the cross-tenant write the first clause
 * exists to stop. INSERT and UPDATE stay scoped to `app.current_org` alone.
 *
 * **There is no DELETE — no grant and no policy — and that is FR-59 made structural.** Removing a
 * member is a status change (see the `status` column below), and P-4's argument applies exactly:
 * a rule the application is trusted to remember is a rule that gets forgotten in task 25.2 or 26.2.
 * With no `DELETE` privilege, the only way a membership row can leave this table is on the
 * cascade from its account or its organization — which is NFR-28's erasure path and nothing else.
 * (Referential-integrity actions bypass row security by design, so those cascades still work.)
 *
 * **What is deliberately absent, so nobody completes it in passing:**
 *
 *  - **Per-report grants.** Rights on a report are computed per request from the organization role,
 *    the period's lock state and the entity — §6.5 closed this on 18 Aug 2026, on the grounds that
 *    no FR creates or revokes a per-report grant and `design_spec.md` has no screen for one.
 *  - **Invitations** (FR-11, FR-57) are their own table under this table's RLS pattern, in task
 *    26.1. A `status` of `pending` is not a member: S-16's "active or pending invitation" is a
 *    union across two tables, which is what the screen actually renders.
 *  - **Seat counting against the plan's entitlement** (§6.10) reads this table through
 *    `EntitlementPort`; it stores nothing here.
 */
export class IdentityMembership1787702400000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  /** The other half of `setTenantContext`'s binding — the acting account, not the tenant. */
  private readonly boundAccount = `NULLIF(current_setting('app.current_user', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `id uuid` is not decoration on a table whose natural key is `(account_id, organization_id)`.
    // `core.capture_field_change` resolves the record it is describing with
    // `coalesce(after ->> 'id', before ->> 'id')::uuid`, so a composite primary key with no `id`
    // column would attach cleanly, migrate cleanly, and fail on the first write — which is the
    // worst place for a plpgsql body to be validated. §7.9's `uuidv7()` convention is load-bearing
    // here rather than merely conventional.
    //
    // The role vocabulary is the three of `functional_requirements.md`'s data model, mirrored by
    // MEMBERSHIP_ROLE in the model (same pattern as `account_status_known`). `editor` and `viewer`
    // are the register's "edit or view-only" as role nouns; `organization_administrator` is
    // actors.md's OA spelled out, as `admin_account_role_known` already spells out PA and BO. CA is
    // **not** a member of this set and must not become one — actors.md is explicit that Common
    // Access is "not a role and not a permission level" but the capabilities every authenticated
    // user holds regardless of which role they occupy.
    //
    // A CHECK rather than a PostgreSQL enum, for task 19's reason: adding a value to an enum type
    // is a catalog change that cannot be done inside every transaction shape, while a CHECK is a
    // constraint swap.
    //
    // `status` is what makes FR-59 non-destructive. Removing a member has to leave the audit trail
    // intact (FR-55), and while `core.field_change`'s `actor_id` carries no foreign key precisely
    // so attribution survives, a deleted membership row also erases the *membership's own* history
    // — when the role was granted, by whom, and when it was withdrawn — which is what an assurance
    // reviewer asking "who could see this data in March" needs. The third CHECK keeps status and
    // instant appearing together, as `account_verified_at_matches_status` does for verification.
    //
    // `last_active_at` is FR-56's "last activity", read by UC-59's list in task 25.2. It is
    // nullable because nothing writes it until task 28's `AuthGuard` resolves a request against
    // this row, and a member who has not returned since being invited genuinely has no last
    // activity — a `created_at` default would answer the question with a fact about the invitation.
    await queryRunner.query(`
      CREATE TABLE identity.membership (
        id              uuid        PRIMARY KEY DEFAULT uuidv7(),
        account_id      uuid        NOT NULL REFERENCES identity.account(id) ON DELETE CASCADE,
        organization_id uuid        NOT NULL REFERENCES core.organization(id) ON DELETE CASCADE,
        role            text        NOT NULL,
        status          text        NOT NULL DEFAULT 'active',
        removed_at      timestamptz,
        last_active_at  timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT membership_role_known
          CHECK (role IN ('editor', 'viewer', 'organization_administrator')),
        CONSTRAINT membership_status_known CHECK (status IN ('active', 'removed')),
        CONSTRAINT membership_removed_at_matches_status
          CHECK ((status = 'removed') = (removed_at IS NOT NULL)),
        CONSTRAINT membership_account_organization_key UNIQUE (account_id, organization_id)
      )
    `);

    // The unique constraint is over the whole pair rather than partial on `status = 'active'`, and
    // that is the soft delete's second consequence: one row per (account, organization) **ever**.
    // Re-inviting someone who was removed (task 26.2) reactivates this row rather than inserting a
    // second, so the change history reads as one arc — invited as editor, promoted, removed,
    // restored — instead of as unrelated rows nothing joins.

    // UC-59 asks "who can see our ESG data" per organization; the unique constraint's index is
    // account-leading and cannot serve it.
    await queryRunner.query(`
      CREATE INDEX membership_organization_idx ON identity.membership (organization_id)
    `);

    // FR-12's active organization, held server-side on the session — AD-12 is explicit that role
    // and active organization are "read server-side on every request from the session and
    // membership records", so this is the record it means. Task 21's migration recorded that the
    // column would arrive "by expand→migrate with the membership tables"; this is that step. Its
    // writer is task 25.4's post-sign-in branch and the global-tier switcher (30.1); task 28's
    // guard is its reader.
    //
    // Two details are decisions. **`ON DELETE SET NULL`, not CASCADE:** deleting an organization
    // must not sign its members out of the platform — it clears what they were looking at.
    // **The column is `active_organization_id`, not `organization_id`,** and the name is doing real
    // work: the schema-invariant gate treats a column called `organization_id` as the mark of a
    // tenant-scoped table and would then require RLS on `identity.session` — where a policy scoped
    // to the bound organization would break every pre-authentication session lookup, for the same
    // reason the membership bootstrap above needed a second policy. The session is not tenant data;
    // it is an account's, and it merely points at a tenant.
    await queryRunner.query(`
      ALTER TABLE identity.session
        ADD COLUMN active_organization_id uuid REFERENCES core.organization(id) ON DELETE SET NULL
    `);

    // Default-deny: the baseline granted schema USAGE only, so each of these is a decision.
    //
    //  - **No DELETE for anyone**, per the header. FR-59 is the `status` update.
    //  - `esg_admin_ro` reads it for FR-76's organization and account register — the console
    //    answers "who belongs to this organization" from here, across tenants, with every
    //    acquisition of the role logged (§7.6, NFR-66).
    //  - `esg_worker` gets nothing yet. It will need SELECT for FR-173's reminder and for
    //    resolving an organization's recipients (task 49 onwards); the grant arrives with the
    //    surface that needs it rather than in anticipation of one.
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE ON identity.membership TO esg_app;
    `);
    await queryRunner.query(`GRANT SELECT ON identity.membership TO esg_admin_ro`);

    // ── Row-level security (DR-5, AD-2, NFR-63) ───────────────────────────────────────────────
    //
    // FORCE as well as ENABLE, for §7.6's reason: `esg_migrator` owns this table and an owner is
    // exempt from its own policies regardless of `rolbypassrls`, so ENABLE alone would be inert for
    // the owner — and invisible, because every probe run as `esg_app` would still pass.
    await queryRunner.query(`ALTER TABLE identity.membership ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE identity.membership FORCE ROW LEVEL SECURITY`);

    // UC-59's read: the members of the organization this request is acting for.
    await queryRunner.query(`
      CREATE POLICY membership_tenant_select ON identity.membership
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);

    // UC-16's read, and the bootstrap the header explains: an account's own memberships, in every
    // organization, whether or not one is bound. Permissive policies are OR'd, so this widens the
    // one above rather than qualifying it — which is the intent, and is why it is SELECT only.
    await queryRunner.query(`
      CREATE POLICY membership_self_select ON identity.membership
        FOR SELECT USING (account_id = ${this.boundAccount})
    `);

    // UC-60's acceptance (task 26.2) and FR-13's founding membership (task 29). A real WITH CHECK,
    // unlike the tenant root's `WITH CHECK (true)`: an organization exists by the time anyone can
    // be made a member of it, so creating the founding membership is a matter of binding the new
    // organization inside the same transaction — not of exempting the insert.
    await queryRunner.query(`
      CREATE POLICY membership_tenant_insert ON identity.membership
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // UC-62's role change, UC-63's removal and UC-64's promotion are all this one policy. The
    // WITH CHECK is what stops a row being moved to another organization, and it is not
    // theoretical here: `organization_id` is an ordinary updatable column on a table whose whole
    // job is to say who may reach a tenant's data.
    await queryRunner.query(`
      CREATE POLICY membership_tenant_update ON identity.membership
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    // Per-field capture (P-11, FR-54, FR-55, FR-159). TG_ARGV[0] names the tenant column;
    // the rest are ignored.
    //
    // `updated_at` is ignored for task 14's reason — it changes on every write and recording it
    // would say nothing twice. `last_active_at` is ignored for a sharper one: task 28's guard
    // touches it on **every request**, so capturing it would make the highest-volume writer in the
    // system a writer of the highest-volume audit table, to record that somebody was present.
    // FR-54 is about who changed a *value*; presence is not one.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON identity.membership
        FOR EACH ROW EXECUTE FUNCTION
          core.capture_field_change('organization_id', 'updated_at', 'last_active_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The trigger goes with the table and needs no separate drop; the column on `session` does,
    // because that table survives this revert.
    await queryRunner.query(`ALTER TABLE identity.session DROP COLUMN active_organization_id`);
    await queryRunner.query(`DROP TABLE identity.membership`);
  }
}

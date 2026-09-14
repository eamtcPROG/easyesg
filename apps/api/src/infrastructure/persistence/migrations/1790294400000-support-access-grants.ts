import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit.support_access_log`'s grant half (task 67.9; FR-77 … FR-79, UC-85, UC-86; §12.5.6's task-67.9 row) —
 * **in the same table, by the project owner's decision of 13 Sep 2026**, which task 67.3's migration recorded:
 * a Platform Administrator's request, an Organization Administrator's grant or decline, an end from either
 * realm, and every read a grant permits, each one row, with a request's state folded from them.
 *
 * **Six columns, each carried by the row kinds that need it**, and one shape check saying which: a request
 * names its ticket and reason; a grant, decline or end names the request it answers and the actor and realm
 * that took it; an access names the request and what was read. `purpose` stops being required, because only
 * an acquisition and an access read anything.
 *
 * **The policies are where consent is enforced, not the api.** The platform insert policy — the one an
 * unbound connection meets — admits an acquisition, a request, an access and a platform end, **and never a
 * grant or a decline**: nobody at the platform can answer for the organization, and this is the database
 * saying so. The organization insert policy admits a grant, decline or end only for the bound organization,
 * only as the organization's realm, and only with the bound member as actor — so a decision row cannot speak
 * for anyone but the member whose request wrote it. **Which member may answer** — an Organization
 * Administrator — is the route's role guard, since a policy here cannot see a role without reading a
 * membership table it has no business binding.
 *
 * **`esg_app` gains `SELECT`, and a select policy that shows it only the bound organization's requests and
 * answers** — never an acquisition, never an access. Unbound, it sees nothing, which is what task 67.3's
 * *neither readable nor rewritable* test now asserts in those words rather than as a refused privilege.
 *
 * **Indexes by request and by organization**, the two ways every read here narrows.
 */
export class SupportAccessGrants1790294400000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  private readonly boundMember = `NULLIF(current_setting('app.current_user', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE audit.support_access_log DROP CONSTRAINT support_access_log_entry_kind_known`,
    );
    await queryRunner.query(`
      ALTER TABLE audit.support_access_log
        ADD COLUMN request_id       uuid,
        ADD COLUMN actor_id         uuid,
        ADD COLUMN actor_realm      text,
        ADD COLUMN ticket_reference text,
        ADD COLUMN reason           text,
        ADD COLUMN subject          text,
        ALTER COLUMN purpose DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE audit.support_access_log
        ADD CONSTRAINT support_access_log_entry_kind_known
          CHECK (entry_kind IN ('acquisition', 'request', 'grant', 'decline', 'end', 'access')),
        ADD CONSTRAINT support_access_log_actor_realm_known
          CHECK (actor_realm IS NULL OR actor_realm IN ('organization', 'platform')),
        ADD CONSTRAINT support_access_log_row_shape CHECK (
          CASE entry_kind
            WHEN 'acquisition' THEN purpose IS NOT NULL AND request_id IS NULL AND actor_id IS NULL
            WHEN 'request' THEN organization_id IS NOT NULL AND request_id IS NULL
                                AND ticket_reference IS NOT NULL AND reason IS NOT NULL
            WHEN 'grant' THEN organization_id IS NOT NULL AND request_id IS NOT NULL
                              AND actor_id IS NOT NULL AND actor_realm = 'organization'
            WHEN 'decline' THEN organization_id IS NOT NULL AND request_id IS NOT NULL
                                AND actor_id IS NOT NULL AND actor_realm = 'organization'
            WHEN 'end' THEN organization_id IS NOT NULL AND request_id IS NOT NULL
                            AND actor_id IS NOT NULL AND actor_realm IS NOT NULL
            WHEN 'access' THEN organization_id IS NOT NULL AND request_id IS NOT NULL AND purpose IS NOT NULL
            ELSE false
          END
        )
    `);

    await queryRunner.query(`
      CREATE INDEX support_access_log_request ON audit.support_access_log (request_id)
        WHERE request_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX support_access_log_organization ON audit.support_access_log (organization_id, occurred_at)
        WHERE organization_id IS NOT NULL
    `);

    await queryRunner.query(`DROP POLICY support_access_log_platform_insert ON audit.support_access_log`);
    await queryRunner.query(`
      CREATE POLICY support_access_log_platform_insert ON audit.support_access_log
        FOR INSERT WITH CHECK (
          ${this.boundOrganization} IS NULL
          AND entry_kind IN ('acquisition', 'request', 'end', 'access')
          AND actor_realm IS DISTINCT FROM 'organization'
        )
    `);
    await queryRunner.query(`
      CREATE POLICY support_access_log_organization_insert ON audit.support_access_log
        FOR INSERT WITH CHECK (
          organization_id = ${this.boundOrganization}
          AND entry_kind IN ('grant', 'decline', 'end')
          AND actor_realm = 'organization'
          AND actor_id = ${this.boundMember}
        )
    `);
    await queryRunner.query(`
      CREATE POLICY support_access_log_organization_select ON audit.support_access_log
        FOR SELECT USING (
          organization_id = ${this.boundOrganization}
          AND entry_kind IN ('request', 'grant', 'decline', 'end')
        )
    `);
    // On the parent only, as the insert grant: a query through the parent is checked against the parent.
    await queryRunner.query(`GRANT SELECT ON audit.support_access_log TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE SELECT ON audit.support_access_log FROM esg_app`);
    await queryRunner.query(`DROP POLICY support_access_log_organization_select ON audit.support_access_log`);
    await queryRunner.query(`DROP POLICY support_access_log_organization_insert ON audit.support_access_log`);
    await queryRunner.query(`DROP POLICY support_access_log_platform_insert ON audit.support_access_log`);
    await queryRunner.query(`
      CREATE POLICY support_access_log_platform_insert ON audit.support_access_log
        FOR INSERT WITH CHECK (${this.boundOrganization} IS NULL)
    `);

    await queryRunner.query(`DROP INDEX audit.support_access_log_organization`);
    await queryRunner.query(`DROP INDEX audit.support_access_log_request`);

    // **Lossy, and the only revert there is.** The grant half's rows cannot be held by the table this reverts
    // to — a request has no purpose, a decision no column for its actor — so they go with the columns. The
    // append-only trigger is lifted for that one statement, by the table's owner, which is §7.7's own account
    // of what an owner can do and why no runtime role is one. A revert in production discards the record of
    // every grant; this comment is where that is said before anyone runs it.
    //
    // **And row security is lifted with it**, because `FORCE` subjects the owner to the table's policies and
    // there is no DELETE policy: without this the statement deletes nothing, reports nothing, and the NOT NULL
    // below fails on the rows it left — which is what `migrations:check` found. The parent's policies are what a
    // statement through the parent meets, so the parent is the one to lift; both return inside this transaction.
    await queryRunner.query(`ALTER TABLE audit.support_access_log NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audit.support_access_log DISABLE TRIGGER no_mutate`);
    await queryRunner.query(`DELETE FROM audit.support_access_log WHERE entry_kind <> 'acquisition'`);
    await queryRunner.query(`ALTER TABLE audit.support_access_log ENABLE TRIGGER no_mutate`);
    await queryRunner.query(`ALTER TABLE audit.support_access_log FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      ALTER TABLE audit.support_access_log
        DROP CONSTRAINT support_access_log_row_shape,
        DROP CONSTRAINT support_access_log_actor_realm_known,
        DROP CONSTRAINT support_access_log_entry_kind_known
    `);
    await queryRunner.query(`
      ALTER TABLE audit.support_access_log
        DROP COLUMN subject,
        DROP COLUMN reason,
        DROP COLUMN ticket_reference,
        DROP COLUMN actor_realm,
        DROP COLUMN actor_id,
        DROP COLUMN request_id,
        ALTER COLUMN purpose SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE audit.support_access_log
        ADD CONSTRAINT support_access_log_entry_kind_known CHECK (entry_kind IN ('acquisition'))
    `);
  }
}

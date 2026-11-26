import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NFR-109's retention, made the database's rule (task 163; `architecture.md` §12.5.6's task-163 row, §12.5.7).
 *
 * **An organization's end is recorded when its row is deleted** (row (1)). Organization life ends only with the deletion
 * of the organization record (182/74), and the notification tables carry no foreign key to `core.organization` — which
 * is what lets a notice outlive its organization by the year NFR-109 asks — so once the row is gone nothing would say
 * when. `notification.record_organization_end` writes the id and the moment into `notification.ended_organization`
 * after every deletion, whatever made it: a request, FR-207's erasure, an operator by hand. **The latest end wins**: an
 * id the database minted never comes back, but a suite's fixed id does, and the later end is the one its notices are
 * dated from.
 *
 * **Each table's `DELETE` policy is the retention itself** (row (2)), `TO esg_worker` and only while no organization is
 * bound — the `*_worker_directory_select` shape — so no defect above the database can delete evidence inside its period,
 * and the purge's statements name no period: each deletes what its policy admits, by the database's `now()`.
 *
 * - **a notice**: a platform notice sent more than a year ago — `delivered_at`, or `last_raised_at` where its dispatch
 *   never finished (row (3)) — or any notice of an organization that ended more than a year ago. A notice of an
 *   organization still on record is admitted by neither arm, however old. Its deliveries go by the cascade, which row
 *   security does not filter, so the delivery table gains no grant;
 * - **a cancellation**: its organization's end, as its notices'. No platform cancellation exists, so there is no
 *   platform arm, and one added later is kept until a task gives it one;
 * - **an ended organization's row**: the same year, so it goes with its organization's last rows, in the purge's one
 *   transaction.
 *
 * **The other policies on `ended_organization` admit every row**: it holds no tenant's data — an id and a moment — and
 * the grants decide who reads it (the worker, the console's read-only role) while no runtime role may write it. The
 * trigger writes as the owner, whom `FORCE` subjects to the policies, which is why its insert and update need one each.
 * The table is under row security at all because its `DELETE` policy is what carries the rule.
 *
 * **`down` loses the record of which organizations ended**, and nothing can restore it: those ids are gone from
 * `core.organization`, and a notice of one becomes one no rule removes.
 */
export class NotificationRetention1794268800000 implements MigrationInterface {
  /** §7.6's binding read, as every policy spells it, asked here whether it is empty. */
  private readonly unbound = `NULLIF(current_setting('app.current_org', true), '') IS NULL`;

  /** Whether a row's organization ended more than a year ago — `organization` is the policy's own column. */
  private endedAYearAgo(organization: string): string {
    return `EXISTS (SELECT 1 FROM notification.ended_organization ended
                     WHERE ended.organization_id = ${organization}
                       AND ended.ended_at < now() - interval '1 year')`;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification.ended_organization (
        organization_id uuid        PRIMARY KEY,
        ended_at        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`ALTER TABLE notification.ended_organization ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE notification.ended_organization FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY ended_organization_select ON notification.ended_organization
        FOR SELECT USING (true)
    `);
    await queryRunner.query(`
      CREATE POLICY ended_organization_recorded ON notification.ended_organization
        FOR INSERT WITH CHECK (true)
    `);
    await queryRunner.query(`
      CREATE POLICY ended_organization_recorded_again ON notification.ended_organization
        FOR UPDATE USING (true) WITH CHECK (true)
    `);
    await queryRunner.query(`
      CREATE POLICY ended_organization_retention_purge ON notification.ended_organization
        FOR DELETE TO esg_worker
        USING (${this.unbound} AND ended_at < now() - interval '1 year')
    `);
    await queryRunner.query(`GRANT SELECT, DELETE ON notification.ended_organization TO esg_worker`);
    await queryRunner.query(`GRANT SELECT ON notification.ended_organization TO esg_admin_ro`);

    // Definer, so the request deleting an organization needs no grant on the record; the path is pinned because a
    // definer function resolving names through the caller's path would run whatever the caller put first.
    await queryRunner.query(`
      CREATE FUNCTION notification.record_organization_end() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $fn$
      BEGIN
        INSERT INTO notification.ended_organization (organization_id) VALUES (OLD.id)
            ON CONFLICT (organization_id) DO UPDATE SET ended_at = EXCLUDED.ended_at;
        RETURN NULL;
      END
      $fn$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION notification.record_organization_end() FROM PUBLIC`);
    await queryRunner.query(`
      CREATE TRIGGER record_organization_end AFTER DELETE ON core.organization
        FOR EACH ROW EXECUTE FUNCTION notification.record_organization_end()
    `);

    await queryRunner.query(`
      CREATE POLICY notification_retention_purge ON notification.notification
        FOR DELETE TO esg_worker
        USING (${this.unbound} AND (
          (organization_id = '00000000-0000-0000-0000-000000000000'::uuid
             AND COALESCE(delivered_at, last_raised_at) < now() - interval '1 year')
          OR ${this.endedAYearAgo('notification.organization_id')}))
    `);
    await queryRunner.query(`
      CREATE POLICY cancellation_retention_purge ON notification.cancellation
        FOR DELETE TO esg_worker
        USING (${this.unbound} AND ${this.endedAYearAgo('cancellation.organization_id')})
    `);
    await queryRunner.query(`GRANT DELETE ON notification.notification, notification.cancellation TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE DELETE ON notification.notification, notification.cancellation FROM esg_worker`);
    await queryRunner.query(`DROP POLICY cancellation_retention_purge ON notification.cancellation`);
    await queryRunner.query(`DROP POLICY notification_retention_purge ON notification.notification`);
    await queryRunner.query(`DROP TRIGGER record_organization_end ON core.organization`);
    await queryRunner.query(`DROP FUNCTION notification.record_organization_end()`);
    await queryRunner.query(`DROP TABLE notification.ended_organization`);
  }
}

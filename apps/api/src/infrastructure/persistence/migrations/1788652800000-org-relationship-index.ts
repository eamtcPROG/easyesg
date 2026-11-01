import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `org_relationship_related_idx`, which duplicates an index PostgreSQL had already built
 * (task 29.1's review).
 *
 * **A B-tree serves any leading-column prefix of itself.** `UNIQUE (organization_id,
 * related_organization_id, kind)` creates an index on those three columns, so it already answers
 * every lookup by `organization_id` alone and by the `(organization_id, related_organization_id)`
 * pair — which is precisely and only what the dropped index covered. It could never be chosen for
 * anything the unique index could not serve; it was pure write amplification and disk.
 *
 * The original migration justified it with §7.3's "lead with `organization_id`, because every
 * RLS-filtered scan predicates on it". That reasoning is right and the unique constraint already
 * satisfies it — the mistake was adding a second index to obtain a property the first one had.
 *
 * **A corrective migration rather than an edit to the one that added it**, following
 * `1788048000000-invitation-policy-narrowing.ts`: the earlier migration has been applied on
 * developer machines and in CI, so rewriting it would leave those schemas silently divergent from
 * the ledger. A migration is history; this is the correction to it.
 */
export class OrgRelationshipIndex1788652800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX core.org_relationship_related_idx`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores exactly what task 29.1 created, so `db:check`'s apply → revert → apply round trip
    // returns the schema it started from rather than an improved version of it.
    await queryRunner.query(`
      CREATE INDEX org_relationship_related_idx
        ON core.org_relationship (organization_id, related_organization_id)
    `);
  }
}

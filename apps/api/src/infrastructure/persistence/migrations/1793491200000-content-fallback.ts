import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-64's runtime queue (task 76; UC-14, UC-74; 182/38; `architecture.md` §12.5.6's task-76 row (5)) — **one row per
 * content key and locale**, with when a reader first and last met the gap and how many did. A work queue of distinct
 * items, not an occurrence log: the count orders the work.
 *
 * **`content_key` is an item's `<kind>/<key>`** (`help_article/first-report`), so the table knows nothing of what a key
 * names; **`locale` carries no list of locales**, because a fourth needs no schema change (FR-63 behaviour 2, NFR-25) —
 * the api only reports a locale the build registers.
 *
 * **The request tier's alone**: `esg_app` writes what readers met and deletes what is translated; the worker has no part.
 * **No `organization_id` and no row security**: a gap is in content every tenant reads, met as often by a visitor with
 * no account. Platform data in `config`, beside the store whose content it is about (§7.1).
 */
export class ContentFallback1793491200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE config.content_fallback (
        content_key   text        NOT NULL,
        locale        text        NOT NULL,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at  timestamptz NOT NULL DEFAULT now(),
        occurrences   bigint      NOT NULL,

        PRIMARY KEY (content_key, locale),
        CONSTRAINT content_fallback_occurred CHECK (occurrences > 0),
        CONSTRAINT content_fallback_seen_in_order CHECK (first_seen_at <= last_seen_at)
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON config.content_fallback TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE config.content_fallback`);
  }
}

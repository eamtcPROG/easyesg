import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When the person said *not now* to S-05's prompt to enrol a second factor (task 190; `architecture.md` §12.5.6's
 * task-190 rows (4) … (6); UC-193's trigger, NFR-95).
 *
 * **On the account, not on a membership.** The prompt appears because a membership is an Organization
 * Administrator's, but the answer is the person's: an administrator of three organizations is asked once, and the
 * owner chose a dismissal that follows the person across devices over one each browser keeps.
 *
 * **A time rather than a flag**, because it costs nothing more and says when — and nullable, because absence is the
 * ordinary state: most accounts have never been asked. Turning the factor off writes it back to `NULL` (row (6)).
 *
 * **No grant and no audit trigger, both on the account-name migration's reasoning**: `esg_app` holds table-wide
 * `UPDATE` on `identity.account` since task 19, so a column grant here would be a no-op that reads as a decision; and
 * an account belongs to no organization, so `core.capture_field_change` has no tenant to file the row under.
 */
export class EnrolmentPromptDismissal1791849600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.account ADD COLUMN enrolment_prompt_dismissed_at timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE identity.account DROP COLUMN enrolment_prompt_dismissed_at`);
  }
}

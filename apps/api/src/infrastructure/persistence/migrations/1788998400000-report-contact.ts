import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-15's report-cover contact on the tenant root (task 30.3).
 *
 * **A second contact, not a rename of the first**, which is the whole reason it is two columns
 * rather than a relabelling of `contact_email`. The platform writes to `contact_email` *about* the
 * organization — verification, invitations, notifications — while these are the person a reader of
 * the **published report** contacts *about its content*. In an SME those are routinely different
 * people: the first is whoever administers the account, the second is whoever will answer a bank's
 * question about a number in B3.
 *
 * It was drawn on S-15 by `EasyESG Organization Admin.dc.html` and named by no requirement, which
 * made it a field the screen would have invented. FR-15 is amended instead (29 Aug 2026, project
 * owner) — `architecture.md` §12.5.6's task-30.3 row carries the reasoning and what was declined.
 *
 * **Nullable, like every other profile field task 29 added**, and for the same reason: S-04
 * collects four fields and S-15 fills in the rest, so an organization exists before it has a cover
 * contact. What makes a value *required* is a validation rule interpreted from configuration at
 * filing time (FR-73, task 40), not a `NOT NULL` that refuses the profile screen its half-complete
 * state.
 *
 * **No `CHECK` on the address.** `organization_contact_email_shape` does not exist either — the
 * shape is a DTO-level `@IsEmail`, and a constraint here would be a fourth copy of a pattern whose
 * authority is RFC 5321 rather than this schema. Length is bounded by the DTO for the same reason
 * `contact_email` is.
 *
 * The capture trigger needs no change: `core.capture_field_change` compares `jsonb` row images, so
 * two new columns are audited the moment they exist. That is the property task 14 was built for and
 * it is worth stating once per migration that relies on it.
 */
export class ReportContact1788998400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        ADD COLUMN report_contact_name  text,
        ADD COLUMN report_contact_email text
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN core.organization.report_contact_name IS
        'FR-15: the contact printed on the report cover. Distinct from contact_email, which is how the platform reaches the organization.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.organization
        DROP COLUMN report_contact_email,
        DROP COLUMN report_contact_name
    `);
  }
}

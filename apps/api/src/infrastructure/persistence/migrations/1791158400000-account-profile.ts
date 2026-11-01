import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * S-27's profile, beyond the two name parts (task 52.3; §12.5.6's task-52.3 row; FR-9, FR-10, FR-52, FR-169).
 *
 * **Two languages beside the interface's, chosen independently** (row (3), §9): `email_locale`, the language every
 * message to this person is written in — which dispatch reads from this task — and `export_locale`, the default an
 * export starts from, overridable on every export and **read by nothing until the export tasks** (43 … 47). `locale`
 * stays the interface's (FR-10). No `CHECK` on either, as `locale` has none: the set of locales is `@easyesg/i18n`'s,
 * NFR-4 puts no limit on it, and a migration per locale added would be the wrong place for that decision.
 *
 * **Both are `NOT NULL` and start as the interface language**, backfilled here and set on every insert by
 * `identity.account_language_defaults` — a trigger rather than a change to each insert, because an account is created
 * by registration, by a provider sign-up and by every suite that seeds one, and a path that forgot would otherwise fail
 * as a constraint violation somewhere unrelated. An insert that names a language keeps it.
 *
 * **An optional job title and an optional phone number** (row (4), FR-9 amended). The title is bounded as a name part
 * is. The phone is stored in one shape, `+` and the digits of an international number (E.164's at most fifteen), so
 * two spellings of one number are one value; the api strips the spaces a person types before it arrives.
 */
export class AccountProfile1791158400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE identity.account
        ADD COLUMN email_locale  text,
        ADD COLUMN export_locale text,
        ADD COLUMN job_title     text,
        ADD COLUMN phone         text
    `);
    await queryRunner.query(`UPDATE identity.account SET email_locale = locale, export_locale = locale`);
    await queryRunner.query(`
      ALTER TABLE identity.account
        ALTER COLUMN email_locale SET NOT NULL,
        ALTER COLUMN export_locale SET NOT NULL,
        ADD CONSTRAINT account_job_title_bounded
          CHECK (job_title IS NULL OR char_length(job_title) BETWEEN 1 AND 100),
        ADD CONSTRAINT account_phone_international
          CHECK (phone IS NULL OR phone ~ '^\\+[1-9][0-9]{6,14}$')
    `);

    await queryRunner.query(`
      CREATE FUNCTION identity.account_language_defaults() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        NEW.email_locale  := COALESCE(NEW.email_locale, NEW.locale);
        NEW.export_locale := COALESCE(NEW.export_locale, NEW.locale);
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER account_language_defaults BEFORE INSERT ON identity.account
        FOR EACH ROW EXECUTE FUNCTION identity.account_language_defaults()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER account_language_defaults ON identity.account`);
    await queryRunner.query(`DROP FUNCTION identity.account_language_defaults()`);
    await queryRunner.query(`
      ALTER TABLE identity.account
        DROP CONSTRAINT account_phone_international,
        DROP CONSTRAINT account_job_title_bounded,
        DROP COLUMN phone,
        DROP COLUMN job_title,
        DROP COLUMN export_locale,
        DROP COLUMN email_locale
    `);
  }
}

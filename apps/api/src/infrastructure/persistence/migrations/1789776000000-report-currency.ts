import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The currency a filing's monetary disclosures are stated in (task 36.12; §7.8, FR-24).
 *
 * **Four Basic-module elements are monetary and three had already shipped without one**: B1's
 * `Assets` and `Turnover` (task 36.2), B2's
 * `FinancialInvestmentInTheCapitalOrAssetsOfSocialEconomyEntities` (36.3), and B11's
 * `TotalAmountOfFinesForTheViolationOfAnticorruptionAndAntibriberyLaws`, which is what brought it to
 * a head. A monetary fact with no unit is not a filing-grade figure — XBRL requires an ISO 4217 unit
 * on one — so task 46 would have met three shipped disclosures it could not emit.
 *
 * **Task 30.2 deferred this on a premise that was false when written**: *"no Basic-module disclosure
 * carries a monetary amount"*. `Assets` and `Turnover` were in the taxonomy artefact task 33.1 had
 * already extracted. The deferral named its own trigger — *"what must change if that is wrong"* — and
 * pointed it at C8 and task 79.8; it fired here instead, three shipped elements earlier.
 *
 * **On the report, not on the value.** EFRAG's Digital Template carries a single `template_currency`
 * for the whole workbook, so a currency per disclosure would be finer than the standard's own model
 * and would let one filing mix currencies with nothing objecting. It also pins like DR-4's version
 * columns: a report keeps the currency it was opened under even if the platform later offers others.
 *
 * **No `UPDATE` grant, which is the same mechanism task 31.3 used for the pin** (DR-6 narrowed from
 * a table to a column). Nothing in the request tier can move it, and that is deliberate rather than
 * unfinished: BR-INV-5 already makes MDL the ledger currency and the platform serves Moldova-resident
 * SMEs, so a per-report *choice* is what task 30.2 correctly called *"an abstraction with one
 * member"*. What this migration adds is the **seam** — the column, the default and the constraint —
 * so the day a second currency is real, granting `UPDATE` and adding a control is a change to the
 * request tier and not to the shape of a filing that has already been stored.
 */
export class ReportCurrency1789776000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.report
        ADD COLUMN reporting_currency text NOT NULL DEFAULT 'MDL'
    `);

    // ISO 4217 alpha-3, checked as a *shape* rather than against a list of codes. The list is data
    // that changes when a currency is introduced or withdrawn, and a CHECK is frozen history the day
    // it ships — the same argument `element_key` makes for carrying no foreign key into a taxonomy
    // table. What the shape catches is the class that would actually occur: a symbol, a name, an
    // empty string, or a lower-case code that would not match `iso4217:` on export.
    await queryRunner.query(`
      ALTER TABLE core.report
        ADD CONSTRAINT report_reporting_currency_shape
          CHECK (reporting_currency ~ '^[A-Z]{3}$')
    `);

    // **Deliberately no GRANT.** `esg_app` holds UPDATE on `scope`, `status` and `updated_at` and on
    // nothing else (task 31.3), so this column joins the two version pins as one the request tier
    // cannot move. Adding it to that grant is what the task making the currency choosable will do.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE core.report DROP CONSTRAINT report_reporting_currency_shape`,
    );
    await queryRunner.query(`ALTER TABLE core.report DROP COLUMN reporting_currency`);
  }
}

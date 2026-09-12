import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The account's name (task 139; FR-9, `design_spec.md` UX-137).
 *
 * **Two columns rather than one `full_name`, and that is the decision the row carries.** A monogram,
 * a sort order and a formal-register salutation each need to know *which part is which*, and a
 * single string cannot say. The display name is **derived** from these two and is deliberately not
 * a column: a stored composite is a third value free to disagree with the parts it was built from,
 * and `identity/account/domain/display-name.ts` makes that disagreement unrepresentable instead.
 *
 * **Both nullable, although S-01 requires both.** The two statements are not in tension and the
 * reason is worth stating where the schema is, not only where the screen is: this table has live
 * rows no backfill can invent a name for, and a provider sign-up seeds the fields from an OIDC
 * assertion's single `displayName` claim, which carries no guarantee of two parts. So the *form*
 * requires what the *schema* must tolerate the absence of — which is why UX-137 specifies a
 * fallback for one part missing, for both missing, and for the monogram in each case.
 *
 * **Declined: a `CHECK` forbidding the empty state.** It would make the provider path and every
 * existing row unrepresentable, which is the same mistake in the opposite direction.
 *
 * **Declined: a split heuristic over `displayName`.** Deliberately not written. Moldovan and Russian
 * naming makes guessing a boundary unreliable, and a wrong split is worse than an absent part a
 * person can fill in — the first is confidently incorrect and invisible, the second is obvious and
 * one edit away.
 *
 * **No audit trigger, and the deliverable originally said there would be one** (corrected 12 Sep
 * 2026, project owner). `core.capture_field_change` writes `core.field_change`, whose
 * `organization_id` is `NOT NULL`; an account belongs to no organization, so the tenant would
 * resolve NULL and every account write would fail. The decision is that the name carries no trail
 * at all: FR-54 and FR-55 govern *disclosure* attribution inside an organization, those rows carry
 * `actor_id` with the name resolved at read time — so a rename never damages historical
 * attribution — and auditing a person's edits to their own profile would cut against NFR-28's
 * erasure obligations rather than serve them.
 *
 * **Length is bounded because the column is unbounded by default**, and an unbounded text column
 * behind a form is a storage-exhaustion path rather than a naming policy. 100 is generous against
 * the longest names the three locales produce and is not a claim about what a name may be.
 */
export class AccountName1789948800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE identity.account
        ADD COLUMN given_name  text,
        ADD COLUMN family_name text
    `);

    await queryRunner.query(`
      ALTER TABLE identity.account
        ADD CONSTRAINT account_given_name_bounded
          CHECK (given_name IS NULL OR char_length(given_name) BETWEEN 1 AND 100),
        ADD CONSTRAINT account_family_name_bounded
          CHECK (family_name IS NULL OR char_length(family_name) BETWEEN 1 AND 100)
    `);

    // An empty string is not an absent name — it is a name-shaped hole that every fallback in
    // UX-137 would then fail to fire on, because `''` is not NULL. The CHECK above rejects it by
    // requiring at least one character, so the only two states are "set" and "absent".

    // **No GRANT, and its absence is checked rather than assumed.** Task 19 gave `esg_app`
    // table-level `SELECT, INSERT, UPDATE, DELETE` on `identity.account`, which covers columns
    // added later — so a `GRANT UPDATE (given_name, family_name)` here would be a no-op that reads
    // as a decision. This repository's own hazard: a statement that matches nothing looks exactly
    // like one that bites. The narrower per-column grants belong to tables that were given narrow
    // grants to begin with, and this is not one.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE identity.account
        DROP CONSTRAINT account_given_name_bounded,
        DROP CONSTRAINT account_family_name_bounded,
        DROP COLUMN given_name,
        DROP COLUMN family_name
    `);
  }
}

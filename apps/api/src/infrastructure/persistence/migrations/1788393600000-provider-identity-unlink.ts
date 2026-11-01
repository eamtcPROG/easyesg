import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `DELETE` on `identity.provider_identity` for `esg_app` — FR-8's unlink (UC-12; task 27.6).
 *
 * **Task 24's migration predicted this migration by name**: its grant comment ends "*DELETE
 * arrives with task 27's unlink surface*". The privilege was withheld under default-deny until the
 * surface that needs it exists, which is the whole point of granting per capability rather than per
 * table — until today, no code path could remove a provider identity even by mistake.
 *
 * **A hard delete rather than a status column, and the unique indexes decide it.** `provider_identity`
 * carries `UNIQUE (provider, subject)` and `UNIQUE (account_id, provider)`. A retained "unlinked"
 * row would hold both pairs occupied forever: the user could never re-link that same Google account
 * — and neither could anyone else, on any account. Task 25.1 keeps membership rows for the opposite
 * reason, and the difference is what each row is: a membership is a record of access that was held,
 * while a provider identity is a *credential*, and a dead credential retained is a slot nobody can
 * reuse. Nothing audit-bearing is lost — `provider_identity` carries no `capture_field_change`
 * trigger, being outside the tenant boundary, so there is no trail to orphan.
 */
export class ProviderIdentityUnlink1788393600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT DELETE ON identity.provider_identity TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE DELETE ON identity.provider_identity FROM esg_app`);
  }
}

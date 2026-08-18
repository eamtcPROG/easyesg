import type { QueryRunner } from 'typeorm';

/**
 * Binds the tenant to the connection for the life of one transaction (AD-2).
 *
 * Three details here are the decision, not an implementation of it:
 *
 * 1. `set_config(..., true)` — NOT `SET LOCAL`. `SET LOCAL` is utility syntax and takes
 *    no bind parameter, so writing it that way forces string interpolation into the one
 *    value the entire tenancy model rests on.
 * 2. The third argument `true` makes the setting transaction-local. Session-scoped SET is
 *    prohibited: it leaks to the next borrower of a pooled connection, which is the single
 *    most common way RLS multi-tenancy is broken in production. PgBouncer runs in
 *    transaction pooling mode, so this is not hypothetical.
 * 3. The policies read `current_setting(..., true)` in the missing_ok form, so an unset
 *    context yields NULL and therefore zero rows — rather than a 500 on every endpoint.
 */
export async function setTenantContext(
  queryRunner: QueryRunner,
  organizationId: string,
  actorId: string,
): Promise<void> {
  await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_org', organizationId]);
  await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_user', actorId]);
}

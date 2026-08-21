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
/**
 * The two identifiers the binding writes. Named rather than positional (CLAUDE.md,
 * "Conventions") because both are `string` and this is the one signature in the codebase where a
 * silent swap is a **tenancy** failure: `app.current_org` set to a user id matches no policy, so
 * every tenant read returns zero rows — which reads downstream as "this customer has no data",
 * exactly the failure `TenantRepository`'s throw exists to prevent, and one that survives review.
 */
export interface TenantBinding {
  readonly organizationId: string;
  readonly actorId: string;
}

export async function setTenantContext(
  queryRunner: QueryRunner,
  binding: TenantBinding,
): Promise<void> {
  await queryRunner.query('SELECT set_config($1, $2, true)', [
    'app.current_org',
    binding.organizationId,
  ]);
  await queryRunner.query('SELECT set_config($1, $2, true)', [
    'app.current_user',
    binding.actorId,
  ]);
}

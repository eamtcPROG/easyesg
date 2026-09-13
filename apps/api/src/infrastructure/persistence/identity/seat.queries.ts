import type { QueryRunner } from 'typeorm';
import { INVITATION_STATUS } from '@api/modules/identity/invitation/models/invitation.model';
import { MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';

/**
 * The seat count, shared by every store that asks for it (task 142) — the invitation store's issue
 * gate, the bearer transaction's acceptance gate and S-16's seats read. **One statement**, for
 * `auth-attempt.queries.ts`'s reason — the gates and the screen must not drift on what a seat is.
 *
 * **No statement names an organization.** Each runs on a transaction with `app.current_org` bound —
 * the request's for the issue and the read, the bearer transaction's own after it binds the
 * invitation's organization — and RLS scopes both subqueries. The one exception below is a lock key,
 * not a predicate.
 */

/**
 * Active members plus every pending invitation, **lapsed included** (§12.5.6's task-142 row) — the
 * same rows `AccessStoreRepository`'s union lists, which `test/seats.e2e-spec.ts` holds equal.
 *
 * It sees the calling transaction's own uncommitted writes, which is what lets the issue and the
 * acceptance gates check after their write with one predicate (`withinSeatAllowance`).
 */
export async function countSeatsHeld(runner: QueryRunner): Promise<number> {
  const rows = (await runner.query(
    `SELECT (SELECT count(*) FROM identity.membership WHERE status = $1)::int
          + (SELECT count(*) FROM identity.invitation WHERE status = $2)::int AS held`,
    [MEMBERSHIP_STATUS.ACTIVE, INVITATION_STATUS.PENDING],
  )) as { held: number }[];
  return rows[0].held;
}

/** Namespaces the lock so it cannot collide with any other advisory lock taken on the cluster. */
const SEAT_LOCK_NAMESPACE = 'identity.seat';

/**
 * Serialises seat-taking writes per organization until the transaction ends.
 *
 * **Why a lock, where the membership collision accepts its race as benign.** Two invitations issued
 * in the same instant at the last seat each insert their row, each count ten — neither sees the
 * other's uncommitted insert — and both commit eleven. The collision row's losing outcome is one
 * redundant invitation; this one's is the ceiling overrun, which is the one number the task makes
 * true. Taken **before the count** and held to commit, the second transaction's count starts after
 * the first commits, sees its row, and refuses.
 *
 * **Transaction-scoped** (`pg_advisory_xact_lock`), never session-scoped: PgBouncer's transaction
 * pooling would hand a session lock to the connection's next borrower, the same reason tenancy binds
 * with `set_config(..., true)`. Acceptance takes none — it never raises the count — and a founding
 * takes none, having no other writer to race.
 *
 * **The key is hashed**, which is AD-7's objection to this function for fiscal numbering, where a
 * collision would merge two gapless series. Here a collision only makes two organizations'
 * seat-taking writes wait on each other for one transaction: latency, never a wrong count (§12.5.6).
 */
export async function holdSeatLock(runner: QueryRunner, organizationId: string): Promise<void> {
  await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `${SEAT_LOCK_NAMESPACE}:${organizationId}`,
  ]);
}

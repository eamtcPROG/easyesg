import type { EntityManager } from 'typeorm';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';

const EDIT_ROLES: readonly string[] = [MEMBERSHIP_ROLE.EDITOR, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR];

/**
 * The accounts of the bound organization's active members with edit access — the Editors and the Organization
 * Administrator (182/135; FR-164's actors) — on the caller's transaction.
 *
 * **One query for the notices that reach them**: FR-166's report update (task 37.3) and FR-164's and FR-165's (task
 * 51.2). Who holds edit access is one rule, and a copy per producer is how two of them would come to disagree about a
 * new role. Bound by `identity.membership`'s tenant policy, as every read of it is.
 */
export async function editAudience(manager: EntityManager): Promise<readonly string[]> {
  const rows = await manager.query<{ account_id: string }[]>(
    `SELECT account_id FROM identity.membership WHERE status = $1 AND role = ANY($2::text[]) ORDER BY account_id`,
    [MEMBERSHIP_STATUS.ACTIVE, EDIT_ROLES],
  );
  return rows.map((row) => row.account_id);
}

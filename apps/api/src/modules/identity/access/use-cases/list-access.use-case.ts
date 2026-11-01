import type { AccessStore } from '../interfaces/access-store.interface';
import type { AccessPage, AccessQuery } from '../models/access.model';

/**
 * UC-59 — view the organization's users and access levels, as one list (FR-56).
 *
 * **A pass-through, and that is the honest shape here.** The rules this use case would otherwise
 * hold are all in places that can enforce them: the tenant scope is RLS (AD-2), the standing is
 * derived in the same statement that filters on it so the two cannot disagree, and the ordering is a
 * product decision the store spells as `ORDER BY`. `ListMembers` next door is the same shape for the
 * same reason.
 *
 * What it is *not* is a place to re-apply any of that "for safety" — a second filter here would be
 * the filtering-at-call-sites AD-2 rejects, and a second standing derivation would be a second
 * clock.
 */
export class ListAccess {
  constructor(private readonly store: AccessStore) {}

  async execute(query: AccessQuery): Promise<AccessPage> {
    return this.store.listAccess(query);
  }
}

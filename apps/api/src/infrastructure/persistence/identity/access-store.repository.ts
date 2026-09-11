import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../tenant-repository';
import { MEMBERSHIP_STATUS, type MembershipRole } from '@api/modules/identity/membership/models/membership.model';
import { INVITATION_STATUS } from '@api/modules/identity/invitation/models/invitation.model';
import type { AccessStore } from '@api/modules/identity/access/interfaces/access-store.interface';
import {
  ACCESS_FILTER_ANY,
  ACCESS_ROW_KIND,
  ACCESS_SORT,
  ACCESS_STANDING,
  type AccessPage,
  type AccessQuery,
  type AccessRow,
  type AccessSort,
  type AccessStanding,
} from '@api/modules/identity/access/models/access.model';

interface AccessDbRow {
  kind: string;
  id: string;
  email: string;
  role: MembershipRole;
  standing: AccessStanding;
  account_id: string | null;
  joined_at: Date | null;
  last_active_at: Date | null;
  issued_at: Date | null;
  expires_at: Date | null;
}

/**
 * The `AccessStore` adapter — S-16's union of `identity.membership` and `identity.invitation`
 * (task 131).
 *
 * **The union is a CTE and everything else happens over it**, which is the whole point of the route:
 * the filter, the ordering and the window are applied to the *merged* set. Two endpoints paged
 * separately cannot produce this, because page 2 of one unioned with page 2 of the other is not page
 * 2 of the union and a sort spanning both cannot be resolved from two ordered responses.
 *
 * **No statement names an organization**, per `MembershipStoreRepository`'s rule and now safely:
 * task 130 narrowed `membership_self_select` so that with an organization bound RLS answers *this
 * organization's rows* and nothing else. Before that, a query like this one would have quietly
 * merged in the caller's memberships elsewhere — which is how FR-60's lockout was bypassable.
 *
 * **`now()` is the clock, and it is the only one.** The standing is derived in the same statement
 * that filters and orders on it, so a row cannot be admitted as live and rendered as expired on one
 * request. The browser tier used to derive it from `Date.now()` after fetching everything; moving
 * the filter here without moving the derivation would have split one fact across two clocks.
 *
 * **Ordering never interpolates a caller's string.** `ORDER_BY` below is a closed map from the
 * `ACCESS_SORT` vocabulary to SQL this file owns, and the direction is a boolean. Two of the four
 * are deliberately not columns: role and standing order by a **rank** the product defines — widest
 * access first, needing-attention first — which is what the chips' tones already imply.
 *
 * **`email` is the tie-break on every ordering**, so the order is total. Without it two equal rows
 * may swap between two requests for the same page, which reads as a row moving under the reader's
 * cursor and, at a page boundary, as a row appearing twice or not at all.
 */
@Injectable()
export class AccessStoreRepository extends TenantRepository<never> implements AccessStore {
  protected readonly entity = 'identity.membership' as never;

  /**
   * The merged set, before any filter.
   *
   * A member's activity is their last request falling back to when they joined — a member who has
   * never signed in is not undated, they are dated from the grant, and sorting them below everyone
   * would be a lie about when they appeared. An invitation's is when it was last sent, which a
   * resend moves. That is the same fact for both halves, which is what lets one column head cover
   * the union honestly.
   */
  private readonly union = `
    SELECT '${ACCESS_ROW_KIND.MEMBER}' AS kind, m.id, a.email, m.role,
           '${ACCESS_STANDING.ACTIVE}' AS standing,
           COALESCE(m.last_active_at, m.created_at) AS activity_at,
           m.account_id, m.created_at AS joined_at, m.last_active_at,
           NULL::timestamptz AS issued_at, NULL::timestamptz AS expires_at
      FROM identity.membership m
      JOIN identity.account a ON a.id = m.account_id
     WHERE m.status = '${MEMBERSHIP_STATUS.ACTIVE}'
     UNION ALL
    SELECT '${ACCESS_ROW_KIND.INVITATION}', i.id, i.invited_email, i.role,
           CASE WHEN i.expires_at <= now()
                THEN '${ACCESS_STANDING.INVITATION_EXPIRED}'
                ELSE '${ACCESS_STANDING.INVITED}' END,
           i.issued_at,
           NULL::uuid, NULL::timestamptz, NULL::timestamptz,
           i.issued_at, i.expires_at
      FROM identity.invitation i
     WHERE i.status = '${INVITATION_STATUS.PENDING}'
  `;

  /** `$1` is the role facet and `$2` the standing facet; `'any'` means the facet is unset. */
  private readonly matches = `($1 = '${ACCESS_FILTER_ANY}' OR role = $1)
                          AND ($2 = '${ACCESS_FILTER_ANY}' OR standing = $2)`;

  private static readonly ORDER_BY: Record<AccessSort, string> = {
    [ACCESS_SORT.PERSON]: 'email',
    [ACCESS_SORT.ROLE]: `CASE role WHEN 'organization_administrator' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END`,
    [ACCESS_SORT.STANDING]: `CASE standing WHEN '${ACCESS_STANDING.INVITATION_EXPIRED}' THEN 0 WHEN '${ACCESS_STANDING.INVITED}' THEN 1 ELSE 2 END`,
    [ACCESS_SORT.ACTIVITY]: 'activity_at',
  };

  async listAccess(query: AccessQuery): Promise<AccessPage> {
    const facets = [query.role, query.standing];

    // Both counts in one statement over one CTE, so they cannot describe different sets. `total` is
    // what tells an empty page whether nobody has been invited yet or the filter matched nobody —
    // §4.6 requires an Index's empty state to teach, and those two teach opposite things.
    const [counts] = await this.manager.query<{ total: number; matched: number }[]>(
      `WITH access AS (${this.union})
       SELECT count(*)::int AS total,
              count(*) FILTER (WHERE ${this.matches})::int AS matched
         FROM access`,
      facets,
    );

    const rows = await this.manager.query<AccessDbRow[]>(
      `WITH access AS (${this.union})
       SELECT kind, id, email, role, standing, account_id, joined_at, last_active_at,
              issued_at, expires_at
         FROM access
        WHERE ${this.matches}
        ORDER BY ${AccessStoreRepository.ORDER_BY[query.sort]} ${query.descending ? 'DESC' : 'ASC'},
                 email ASC
        LIMIT $3 OFFSET $4`,
      [...facets, query.take, query.skip],
    );

    return { rows: rows.map(toAccessRow), matched: counts.matched, total: counts.total };
  }
}

/**
 * One database row to one member of the union.
 *
 * The discriminator decides which fields are real, and the non-null assertions are where the CTE's
 * shape is asserted rather than assumed: a member always has `account_id` and `joined_at`, an
 * invitation always has `issued_at` and `expires_at`, because the two halves of the `UNION ALL`
 * select them as literals and as columns respectively.
 */
const toAccessRow = (row: AccessDbRow): AccessRow =>
  row.kind === ACCESS_ROW_KIND.MEMBER
    ? {
        kind: ACCESS_ROW_KIND.MEMBER,
        id: row.id,
        email: row.email,
        role: row.role,
        standing: ACCESS_STANDING.ACTIVE,
        accountId: row.account_id as string,
        lastActiveAt: row.last_active_at,
        joinedAt: row.joined_at as Date,
      }
    : {
        kind: ACCESS_ROW_KIND.INVITATION,
        id: row.id,
        email: row.email,
        role: row.role,
        standing: row.standing,
        issuedAt: row.issued_at as Date,
        expiresAt: row.expires_at as Date,
      };

import { MEMBERSHIP_ROLE, type MembershipRole } from '@easyesg/contracts';

/**
 * How A-02's record names a member's role (task 167) — the tenant's role vocabulary, labelled. `satisfies` fails the
 * build when a role arrives without a label, as the log's action labels do.
 */
export const MEMBER_ROLE_LABEL = {
  [MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR]: 'organizationAdministrator',
  [MEMBERSHIP_ROLE.EDITOR]: 'editor',
  [MEMBERSHIP_ROLE.VIEWER]: 'viewer',
} as const satisfies Record<MembershipRole, string>;

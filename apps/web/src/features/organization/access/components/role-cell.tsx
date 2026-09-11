'use client';

import { Select } from '@easyesg/ui';
import { MEMBERSHIP_ROLE, type MembershipRole } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess, useRowBusy } from './access-context';
import { changeMemberRoleAction } from '../actions/actions';
import { ACCESS_ROW_KIND, isLastAdministrator, type AccessRow } from '../tools/access';

/**
 * One of the two cells that act on a row — `row-actions.tsx` is the other.
 *
 * Both take **only the row**. Everything else — the other rows FR-60's rule needs, whether an
 * action is running, how to run one — comes from `useAccess()`, which is what a cell five levels
 * inside a `DataTable` can reach and a prop cannot.
 */

/**
 * A member's role is editable in place; an invitation's is not.
 *
 * An invitation's role is a promise already made to someone by email — changing it silently would
 * mean the link they hold grants something other than what they were told. UC-61 gives the
 * administrator revoke and re-invite, which is the honest way to change that promise.
 */
export function RoleCell({ row }: { readonly row: AccessRow }) {
  const t = useTranslations('organization.access');
  const tRoles = useTranslations('organization.access.roles');
  const { page, perform } = useAccess();
  const busy = useRowBusy(row);

  const change = useCallback(
    (chosen: string) => {
      // `onValueChange` hands back the raw option value; narrowing once here keeps the cast off
      // both the request and the message, where two casts could disagree about the same value.
      const role = chosen as MembershipRole;
      perform({
        row,
        action: () => changeMemberRoleAction({ membershipId: row.id, role }),
        success: t('roleChanged', { email: row.email, role: tRoles(role) }),
      });
    },
    [perform, row, t, tRoles],
  );

  if (row.kind === ACCESS_ROW_KIND.INVITATION) return <>{tRoles(row.role)}</>;

  // FR-60: the last administrator cannot be demoted. The API refuses it and stays authoritative —
  // this only avoids OFFERING the action, and states why rather than showing a dead control.
  const locked = isLastAdministrator({ administrators: page.administrators, row });

  return (
    <Select
      label={t('actions.changeRole', { email: row.email })}
      labelHidden
      value={row.role}
      disabled={busy || locked}
      help={locked ? t('actions.lastAdministrator') : undefined}
      onValueChange={change}
      options={Object.values(MEMBERSHIP_ROLE).map((role) => ({
        value: role,
        label: tRoles(role),
      }))}
    />
  );
}

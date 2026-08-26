'use client';

import { Button, Select } from '@easyesg/ui';
import { MEMBERSHIP_ROLE, type MembershipRole } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess, useRowBusy } from './access-context';
import { CONFIRMATION } from '../access-state';
import { changeMemberRoleAction, resendInvitationAction } from '../actions';
import { ACCESS_ROW_KIND, isLastAdministrator, type AccessRow } from '../access';
import styles from './access.module.css';

/**
 * The two cells that act on a row.
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
  const locked = isLastAdministrator({ rows: page.rows, row });

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

/**
 * What can be done to this row — different verbs on different objects, chosen by the union's own
 * discriminator rather than by a flag. A single actions menu parameterised by booleans is the shape
 * UX-89 warns about, and would have had to decide what "change role" means for someone who has not
 * accepted.
 */
export function RowActions({ row }: { readonly row: AccessRow }) {
  const t = useTranslations('organization.access.actions');
  const tAccess = useTranslations('organization.access');
  const { page, ask, perform } = useAccess();
  const busy = useRowBusy(row);

  const resend = useCallback(
    () =>
      perform({
        row,
        action: () => resendInvitationAction({ invitationId: row.id }),
        success: tAccess('resent', { email: row.email }),
      }),
    [perform, row, tAccess],
  );

  const confirmRevoke = useCallback(
    () => ask({ kind: CONFIRMATION.REVOKE, row }),
    [ask, row],
  );
  const confirmRemove = useCallback(
    () => ask({ kind: CONFIRMATION.REMOVE, row }),
    [ask, row],
  );

  if (row.kind === ACCESS_ROW_KIND.INVITATION) {
    return (
      <div className={styles.rowActions}>
        <Button variant="subtle" disabled={busy} onClick={resend}>
          {t('resend')}
        </Button>
        <Button variant="subtle" disabled={busy} onClick={confirmRevoke}>
          {t('revoke')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.rowActions}>
      <Button
        variant="destructive"
        disabled={busy || isLastAdministrator({ rows: page.rows, row })}
        onClick={confirmRemove}
      >
        {t('remove')}
      </Button>
    </div>
  );
}
